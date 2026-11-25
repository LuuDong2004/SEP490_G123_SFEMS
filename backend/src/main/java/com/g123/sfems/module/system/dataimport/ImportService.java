package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.office.SpreadsheetReader;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nhập dữ liệu hàng loạt từ tệp: tải mẫu, xem trước, nhập.
 *
 * <p><b>Tất cả hoặc không gì.</b> Còn một dòng lỗi thì không dòng nào được ghi.
 * Nhập một nửa để lại một tệp mà người dùng không còn biết dòng nào đã vào,
 * dòng nào chưa — lần tải lên thứ hai sẽ báo trùng mã đúng ở những dòng đã vào,
 * và người ta sẽ xoá chúng khỏi tệp bằng tay. Bước xem trước chạy đúng bộ kiểm
 * tra của bước nhập, nên thứ người dùng thấy "hợp lệ" là thứ sẽ được ghi.
 *
 * <p>Tiêu đề cột được tìm theo NHÃN, không theo vị trí: tệp mẫu có hai dòng tên
 * và ghi chú phía trên, người dùng đổi thứ tự cột hay chèn một cột riêng của họ
 * đều không làm lệch dữ liệu.
 */
@Service
public class ImportService {

    private static final Logger log = LoggerFactory.getLogger(ImportService.class);

    public record RowError(int row, String code, List<String> messages) {
    }

    public record Preview(String target, int total, int valid, List<RowError> errors, List<Map<String, String>> sample,
            boolean committed) {
    }

    private final Map<String, ImportTarget<?>> targets = new LinkedHashMap<>();
    private final VisibleSchools visibleSchools;
    private final RowLevelPrincipalResolver principals;

    public ImportService(List<ImportTarget<?>> targets, VisibleSchools visibleSchools,
            RowLevelPrincipalResolver principals) {
        targets.forEach(t -> this.targets.put(t.name(), t));
        this.visibleSchools = visibleSchools;
        this.principals = principals;
    }

    /** Các loại dữ liệu người gọi được nhập — có quyền tạo của chính loại đó. */
    public List<ImportTarget<?>> targets() {
        return targets.values().stream().filter(t -> CurrentUser.has(t.permission())).toList();
    }

    public String title(String name) {
        return target(name).title();
    }

    public byte[] template(String name) {
        ImportTarget<?> target = target(name);
        List<XlsxWriter.Column> columns = target.columns().stream()
                .map(c -> new XlsxWriter.Column(c.key(), c.label() + (c.required() ? " (*)" : ""), "text")).toList();
        Map<String, Object> hint = new HashMap<>();
        target.columns().forEach(c -> hint.put(c.key(), c.hint()));
        return XlsxWriter.write(new XlsxWriter.Sheet("Mẫu nhập: " + target.title(),
                "Cột có (*) là bắt buộc. Xoá dòng hướng dẫn này trước khi nhập.", columns, List.of(hint)));
    }

    public Preview preview(String name, Long schoolId, String filename, byte[] content) {
        return run(target(name), resolveSchool(schoolId), filename, content, false);
    }

    @Transactional
    public Preview commit(String name, Long schoolId, String filename, byte[] content) {
        return run(target(name), resolveSchool(schoolId), filename, content, true);
    }

    // ------------------------------------------------------------------ nội bộ

    private <R> Preview run(ImportTarget<R> target, Long schoolId, String filename, byte[] content, boolean commit) {
        if (!CurrentUser.has(target.permission())) {
            throw new AccessDeniedException(target.permission());
        }
        List<List<String>> sheet = SpreadsheetReader.read(filename, content);
        Map<String, String> byLabel = new HashMap<>();
        for (ImportTarget.Column c : target.columns()) {
            byLabel.put(ImportValues.fold(c.label()), c.key());
            byLabel.put(ImportValues.fold(c.key()), c.key());
        }
        int headerIndex = -1;
        Map<Integer, String> keys = new HashMap<>();
        for (int i = 0; i < Math.min(sheet.size(), 10) && headerIndex < 0; i++) {
            Map<Integer, String> found = new HashMap<>();
            List<String> cells = sheet.get(i);
            for (int c = 0; c < cells.size(); c++) {
                String key = byLabel.get(ImportValues.fold(cells.get(c).replace("(*)", "")));
                if (key != null) {
                    found.put(c, key);
                }
            }
            if (found.values().containsAll(target.columns().stream().filter(ImportTarget.Column::required)
                    .map(ImportTarget.Column::key).toList())) {
                headerIndex = i;
                keys = found;
            }
        }
        if (headerIndex < 0) {
            throw new FieldValidationException("file", "Không tìm thấy dòng tiêu đề — tệp phải có đủ các cột bắt buộc: "
                    + String.join(", ", target.columns().stream().filter(ImportTarget.Column::required)
                            .map(ImportTarget.Column::label).toList()));
        }

        List<RowError> errors = new ArrayList<>();
        List<R> requests = new ArrayList<>();
        List<Integer> requestRows = new ArrayList<>();
        List<Map<String, String>> sample = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        Map<String, Integer> seenUnique = new HashMap<>();
        int total = 0;
        for (int i = headerIndex + 1; i < sheet.size(); i++) {
            List<String> cells = sheet.get(i);
            Map<String, String> row = new HashMap<>();
            for (Map.Entry<Integer, String> k : keys.entrySet()) {
                row.put(k.getValue(), k.getKey() < cells.size() ? cells.get(k.getKey()) : "");
            }
            if (row.values().stream().allMatch(v -> v == null || v.isBlank())) {
                continue;
            }
            // Dòng hướng dẫn của tệp mẫu, nếu người dùng quên xoá.
            if (i == headerIndex + 1 && isHintRow(target, row)) {
                continue;
            }
            total++;
            int excelRow = i + 1;
            ImportTarget.Parsed<R> parsed = target.parse(row, schoolId);
            List<String> messages = new ArrayList<>(parsed.errors());
            String code = parsed.code();
            if (code != null) {
                if (!seen.add(code.toUpperCase(Locale.ROOT))) {
                    messages.add(target.codeLabel() + " \"" + code + "\" lặp lại trong tệp");
                } else if (target.exists(schoolId, code)) {
                    messages.add(target.codeLabel() + " \"" + code + "\" đã có trong trường");
                }
            }
            if (parsed.request() != null) {
                for (ImportTarget.Unique u : target.uniques(parsed.request())) {
                    Integer first = seenUnique.putIfAbsent(u.label() + ":" + u.key(), excelRow);
                    if (first != null) {
                        messages.add(u.label() + " \"" + u.value() + "\" trùng với dòng " + first);
                    }
                }
            }
            if (messages.isEmpty()) {
                requests.add(parsed.request());
                requestRows.add(excelRow);
                if (sample.size() < 20) {
                    sample.add(row);
                }
            } else {
                errors.add(new RowError(excelRow, code, messages));
            }
        }
        if (total == 0) {
            throw new FieldValidationException("file", "Tệp không có dòng dữ liệu nào dưới dòng tiêu đề");
        }
        if (commit) {
            if (!errors.isEmpty()) {
                throw new FieldValidationException("file",
                        "Còn %d dòng lỗi — sửa hết rồi nhập lại; chưa dòng nào được ghi".formatted(errors.size()));
            }
            for (int n = 0; n < requests.size(); n++) {
                try {
                    target.create(requests.get(n));
                } catch (RuntimeException e) {
                    // Số dòng là dòng của tệp Excel — như ở bước xem trước — không phải thứ tự trong các dòng hợp lệ
                    // (dòng trống, dòng hướng dẫn đã bị bỏ qua). Lỗi nghiệp vụ đã là câu tiếng Việt; lỗi khác (ràng
                    // buộc database…) mang câu SQL, nên chỉ ghi log và báo một câu chung.
                    boolean business = e instanceof FieldValidationException || e instanceof ConflictException
                            || e instanceof ResourceNotFoundException;
                    if (!business) {
                        log.warn("Nhập dòng {} không ghi được", requestRows.get(n), e);
                    }
                    String reason = business ? e.getMessage() : "dữ liệu trùng hoặc không hợp lệ với dữ liệu đã có";
                    throw new FieldValidationException("file", "Dòng %d: %s — chưa dòng nào được ghi"
                            .formatted(requestRows.get(n), reason));
                }
            }
        }
        return new Preview(target.name(), total, requests.size(), errors, sample, commit);
    }

    private static boolean isHintRow(ImportTarget<?> target, Map<String, String> row) {
        return target.columns().stream().filter(c -> !c.hint().isBlank())
                .anyMatch(c -> c.hint().equals(row.get(c.key())));
    }

    private Long resolveSchool(Long requested) {
        Set<Long> visible = visibleSchools.current();
        if (requested == null) {
            Long own = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
            if (own == null) {
                throw new FieldValidationException("schoolId", "Chọn trường nhận dữ liệu");
            }
            return own;
        }
        if (visible != null && !visible.contains(requested)) {
            throw new ResourceNotFoundException("School", requested);
        }
        return requested;
    }

    @SuppressWarnings("unchecked")
    private <R> ImportTarget<R> target(String name) {
        ImportTarget<?> target = targets.get(name);
        if (target == null) {
            throw new ResourceNotFoundException("ImportTarget", name);
        }
        return (ImportTarget<R>) target;
    }
}
