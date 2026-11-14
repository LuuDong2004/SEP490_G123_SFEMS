package com.g123.sfems.module.catalog.ward;

import com.g123.sfems.domain.catalog.ward.Ward;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.office.SheetImport;
import com.g123.sfems.shared.office.SheetImport.Applied;
import com.g123.sfems.shared.office.SheetImport.Change;
import com.g123.sfems.shared.office.SheetImport.Checked;
import com.g123.sfems.shared.office.SheetImport.Column;
import com.g123.sfems.shared.office.SheetImport.Input;
import com.g123.sfems.shared.office.SheetImport.Issue;
import com.g123.sfems.shared.office.SheetImport.Result;
import com.g123.sfems.shared.office.SheetImport.RowCheck;
import com.g123.sfems.shared.office.SheetImport.Snapshot;
import com.g123.sfems.shared.validation.FieldRule;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cập nhật danh mục PHƯỜNG/XÃ từ tệp Excel — chạy qua lô nhập (vùng chờ) ở màn Nhập dữ liệu. Ghép theo mã đơn vị
 * hành chính: mã có rồi thì sửa tên, ghi chú, bật lại nếu đang ngừng; mã chưa có thì thêm. Tạo và sửa đi qua
 * {@link WardService}, cùng kiểm tra như thêm tay.
 *
 * <p><b>Ngừng phường không có trong tệp</b> (tuỳ chọn): chỉ tắt cờ đang dùng, không xoá; phường còn trường gắn vào thì
 * giữ. Một lần không ngừng quá {@link #MAX_DEACTIVATE_SHARE} số phường đang dùng. Phường mới hoặc đổi tên mà chưa có
 * "UBND &lt;tên&gt;" thì báo lưu ý: cơ quan quản lý của trường Tiểu học, THCS trên địa bàn phải thêm ở màn Cơ quan
 * quản lý. Ghi giữ giá trị cũ để hoàn tác.
 */
@Service
@Transactional(readOnly = true)
public class WardImportService {

    public static final List<Column> COLUMNS = List.of(
            new Column("code", "Mã", true, "Mã đơn vị hành chính, vd. 26734",
                    List.of("Mã phường/xã", "Mã phường xã", "Mã ĐVHC", "Mã đơn vị hành chính")),
            new Column("name", "Tên", true, "Vd. Phường Thủ Đức",
                    List.of("Tên phường/xã", "Tên phường xã", "Phường / xã", "Phường/xã")),
            new Column("note", "Ghi chú", false, "", List.of()));

    public static final int MAX_ROWS = 1_000;

    /** Không ngừng quá tỷ lệ này số phường/xã đang dùng trong một lần. */
    private static final double MAX_DEACTIVATE_SHARE = 0.3;

    /** Mã đơn vị hành chính: chữ số. */
    private static final Pattern CODE = Pattern.compile("^[0-9]{1,10}$");

    private record Existing(long id, String code, String name, String note, boolean active) {
    }

    private static final class Row {
        int excelRow;
        String code;
        String name;
        String note;
        Existing existing;
        final List<String> fields = new ArrayList<>();
    }

    private static final class Plan {
        int total;
        final List<Row> rows = new ArrayList<>();
        final List<Issue> errors = new ArrayList<>();
        final List<Issue> warnings = new ArrayList<>();
        final List<String> batchErrors = new ArrayList<>();
        final List<Existing> deactivate = new ArrayList<>();
        final List<Existing> kept = new ArrayList<>();
        final Map<Long, RowCheck> checks = new LinkedHashMap<>();

        Checked checked() {
            List<Change> changes = new ArrayList<>();
            int created = 0;
            int updated = 0;
            int unchanged = 0;
            for (Row r : rows) {
                if (r.existing == null) {
                    created++;
                    changes.add(new Change("CREATE", r.excelRow, r.code, null, r.name, List.of()));
                } else if (!r.fields.isEmpty()) {
                    updated++;
                    changes.add(new Change("UPDATE", r.excelRow, r.code, null, r.name, r.fields));
                } else {
                    unchanged++;
                }
            }
            deactivate.forEach(w -> changes.add(new Change("DEACTIVATE", null, w.code(), null, w.name(), List.of())));
            kept.forEach(w -> changes.add(
                    new Change("KEEP", null, w.code(), null, w.name(), List.of("còn trường gắn vào"))));
            List<Issue> allErrors = new ArrayList<>(errors);
            batchErrors.forEach(e -> allErrors.add(new Issue(0, null, null, List.of(e))));
            return new Checked(new Result(total, 0, created, updated, unchanged, deactivate.size(), allErrors, warnings,
                    changes, false), checks, batchErrors);
        }
    }

    private final WardService wards;
    private final JdbcTemplate jdbc;

    public WardImportService(WardService wards, JdbcTemplate jdbc) {
        this.wards = wards;
        this.jdbc = jdbc;
    }

    public Checked check(List<Input> inputs, boolean deactivateMissing) {
        return plan(inputs, deactivateMissing).checked();
    }

    @Transactional
    public Applied apply(List<Input> inputs, boolean deactivateMissing) {
        Plan plan = plan(inputs, deactivateMissing);
        int errors = plan.errors.size() + plan.batchErrors.size();
        if (errors > 0) {
            throw new FieldValidationException("file", "Còn %d lỗi — sửa hết rồi ghi; chưa dòng nào được ghi".formatted(errors));
        }
        List<Long> created = new ArrayList<>();
        List<Snapshot> snapshots = new ArrayList<>();
        for (Row r : plan.rows) {
            if (r.existing == null) {
                Ward w = wards.create(new CatalogRequest(r.code, r.name, null, true, r.note));
                created.add(w.getId());
            } else if (!r.fields.isEmpty()) {
                snapshots.add(new Snapshot(r.existing.id(), "UPDATE", before(r.existing)));
                wards.update(r.existing.id(), new CatalogPatchRequest(null, r.name, null, true, r.note));
            }
        }
        for (Existing w : plan.deactivate) {
            snapshots.add(new Snapshot(w.id(), "DEACTIVATE", before(w)));
            wards.update(w.id(), new CatalogPatchRequest(null, null, null, false, null));
        }
        return new Applied(created, snapshots);
    }

    /** Hoàn tác: trả phường đã sửa / ngừng về giá trị cũ, xoá phường lô thêm khi chưa có trường nào gắn vào. */
    @Transactional
    public void undo(List<Long> created, List<Snapshot> snapshots, Instant committedAt) {
        Set<Long> used = new HashSet<>(
                jdbc.queryForList("SELECT DISTINCT ward_id FROM schools WHERE ward_id IS NOT NULL", Long.class));
        for (Long id : created) {
            if (used.contains(id)) {
                throw new ConflictException("Phường/xã lô đã thêm (id " + id + ") đã có trường gắn vào — không hoàn tác được");
            }
        }
        List<Long> touched = new ArrayList<>(created);
        snapshots.forEach(s -> touched.add(s.recordId()));
        if (!touched.isEmpty() && committedAt != null) {
            List<String> changedAfter = jdbc.queryForList("SELECT code FROM wards WHERE id = ANY (?) AND updated_at > ?",
                    String.class, touched.toArray(Long[]::new), Timestamp.from(committedAt.plusSeconds(60)));
            if (!changedAfter.isEmpty()) {
                throw new ConflictException("Phường/xã " + changedAfter.get(0) + " đã được sửa sau khi ghi lô — không hoàn tác được");
            }
        }
        for (Snapshot snap : snapshots) {
            Map<String, Object> b = snap.before();
            String note = (String) b.get("note");
            wards.update(snap.recordId(), new CatalogPatchRequest(null, (String) b.get("name"), null,
                    (Boolean) b.get("active"), note == null ? "" : note));
        }
        for (Long id : created) {
            wards.delete(id);
        }
    }

    // ------------------------------------------------------------------ nội bộ

    private static Map<String, Object> before(Existing w) {
        Map<String, Object> b = new HashMap<>();
        b.put("name", w.name());
        b.put("note", w.note());
        b.put("active", w.active());
        return b;
    }

    private Plan plan(List<Input> inputs, boolean deactivateMissing) {
        if (inputs.size() > MAX_ROWS) {
            throw new FieldValidationException("file", "Lô có quá %,d dòng".formatted(MAX_ROWS));
        }
        Map<Long, Integer> schoolsPerWard = new HashMap<>();
        jdbc.query("SELECT ward_id, count(*) FROM schools WHERE ward_id IS NOT NULL GROUP BY ward_id", rs -> {
            schoolsPerWard.put(rs.getLong(1), rs.getInt(2));
        });
        Map<String, Existing> byCode = new LinkedHashMap<>();
        jdbc.query("SELECT id, code, name, note, active FROM wards ORDER BY sort_order, name", rs -> {
            Existing w = new Existing(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                    rs.getString("note"), rs.getBoolean("active"));
            byCode.put(w.code().trim().toUpperCase(Locale.ROOT), w);
        });
        SheetImport.NameIndex bodies = new SheetImport.NameIndex();
        jdbc.query("SELECT id, name FROM departments_of_education", rs -> {
            bodies.put(rs.getString(2), rs.getLong(1));
        });

        Plan plan = new Plan();
        Map<String, Integer> seenCode = new HashMap<>();
        Map<String, Integer> seenName = new HashMap<>();
        for (Input in : inputs) {
            int excelRow = in.row();
            plan.total++;
            Row row = new Row();
            row.excelRow = excelRow;
            row.code = SheetImport.clean(in.values().get("code"));
            row.name = SheetImport.clean(in.values().get("name"));
            row.note = SheetImport.clean(in.values().get("note"));
            List<String> errors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            if (row.code == null) {
                errors.add("Thiếu mã");
            } else if (!CODE.matcher(row.code).matches()) {
                errors.add("Mã \"" + row.code + "\" sai định dạng (mã đơn vị hành chính là chữ số)");
            } else {
                Integer first = seenCode.putIfAbsent(row.code.toUpperCase(Locale.ROOT), excelRow);
                if (first != null) {
                    errors.add("Mã trùng với dòng " + first);
                }
            }
            SheetImport.check(errors, "Tên", row.name, FieldRule.NAME, 0);
            SheetImport.check(errors, "Ghi chú", row.note, FieldRule.NOTE, 0);
            if (row.name == null) {
                errors.add("Thiếu tên");
            } else {
                Integer first = seenName.putIfAbsent(SheetImport.lower(row.name), excelRow);
                if (first != null) {
                    warnings.add("Tên trùng với dòng " + first);
                }
            }
            row.existing = row.code == null ? null : byCode.get(row.code.toUpperCase(Locale.ROOT));
            if (row.existing != null && errors.isEmpty()) {
                Existing e = row.existing;
                if (!SheetImport.same(row.name, e.name())) {
                    row.fields.add("tên");
                }
                if (row.note != null && !SheetImport.same(row.note, e.note())) {
                    row.fields.add("ghi chú");
                }
                if (!e.active()) {
                    row.fields.add("dùng lại");
                }
                Integer schools = schoolsPerWard.get(e.id());
                if (row.fields.contains("tên") && schools != null) {
                    warnings.add("Đổi tên phường/xã đang gắn " + schools + " trường; cơ quan quản lý UBND cũ giữ tên cũ");
                }
            }
            boolean newName = row.existing == null || !SheetImport.same(row.name, row.existing.name());
            if (errors.isEmpty() && newName && !bodies.contains("UBND " + row.name)) {
                warnings.add("Chưa có cơ quan quản lý \"UBND " + row.name + "\" — thêm ở màn Cơ quan quản lý");
            }
            String change = row.existing == null ? "Thêm mới"
                    : row.fields.isEmpty() ? "Không đổi" : "Cập nhật: " + String.join(", ", row.fields);
            String status = !errors.isEmpty() ? "ERROR" : !warnings.isEmpty() ? "WARNING"
                    : row.existing != null && row.fields.isEmpty() ? "EXISTS" : "OK";
            plan.checks.put(in.id(), new RowCheck(status, errors, warnings, change));
            if (!errors.isEmpty()) {
                plan.errors.add(new Issue(excelRow, row.code, row.name, errors));
            } else {
                plan.rows.add(row);
            }
            if (!warnings.isEmpty()) {
                plan.warnings.add(new Issue(excelRow, row.code, row.name, warnings));
            }
        }

        if (deactivateMissing) {
            Set<String> inFile = new HashSet<>(seenCode.keySet());
            for (Map.Entry<String, Existing> e : byCode.entrySet()) {
                Existing w = e.getValue();
                if (!w.active() || inFile.contains(e.getKey())) {
                    continue;
                }
                (schoolsPerWard.containsKey(w.id()) ? plan.kept : plan.deactivate).add(w);
            }
            long active = byCode.values().stream().filter(Existing::active).count();
            if (plan.deactivate.size() > active * MAX_DEACTIVATE_SHARE) {
                plan.batchErrors.add(("Sẽ ngừng %d/%d phường/xã đang dùng — quá %d%%; tệp có thể thiếu dòng. Kiểm tra"
                        + " lại tệp, hoặc bỏ chọn ngừng.").formatted(plan.deactivate.size(), active,
                        Math.round(MAX_DEACTIVATE_SHARE * 100)));
            }
        }
        return plan;
    }
}
