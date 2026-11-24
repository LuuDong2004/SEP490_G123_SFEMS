package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.shared.exception.FieldValidationException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * {@code /api/data_imports} — nhập dữ liệu đầu vào của một trường qua vùng chờ ({@link OnboardingService}).
 *
 * <ul>
 *   <li>{@code GET /sheets}, {@code GET /template} — các trang của tệp và tệp mẫu;</li>
 *   <li>{@code POST /} (multipart {@code file}, {@code schoolId}) — đọc tệp vào một lô mới;</li>
 *   <li>{@code GET /{id}/rows?sheet=} — dòng chờ của một trang, kèm lỗi / cảnh báo;</li>
 *   <li>{@code PATCH /{id}/rows/{rowId}}, {@code POST /{id}/rows} — sửa ô, bỏ / dùng lại, thêm dòng;</li>
 *   <li>{@code POST /{id}/commit}, {@code POST /{id}/rollback} — ghi vào hệ thống, hoàn tác;</li>
 *   <li>{@code GET /{id}/report} — tệp Excel kết quả kiểm tra, gửi lại trường.</li>
 * </ul>
 *
 * <p>Danh sách trả mảng trần như mọi tài nguyên khác — không phân trang: một trường chỉ có vài lô.
 */
@RestController
@RequestMapping("/api/data_imports")
public class OnboardingController {

    private static final long MAX_UPLOAD = 10L * 1024 * 1024;
    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    public record RowPatch(Map<String, String> data, Boolean skipped) {
    }

    /** {@code source}: tay (mặc định), {@code rule} — sửa nhanh, {@code ai}. */
    public record NewRow(@Size(max = 100, message = "Tên trang không hợp lệ") String sheet, Map<String, String> data,
            String source) {
    }

    public record RowEdits(@Valid List<OnboardingService.RowEdit> edits) {
    }

    public record RowIds(List<Long> rowIds) {
    }

    public record AiRequest(@Size(max = 100, message = "Tên trang không hợp lệ") String sheet, List<Long> rowIds) {
    }

    /** Màn hình hỏi trước khi vẽ nút "AI gợi ý": có bật không, trang nào dùng được, mỗi lần bao nhiêu dòng. */
    public record AiInfo(boolean enabled, List<String> sheets, int maxRows, int maxRowsPerClick) {
    }

    public record SheetRequest(@Size(max = 100, message = "Tên trang không hợp lệ") String sheet) {
    }

    private final OnboardingService service;
    private final OnboardingAiService ai;
    private final OnboardingQuickFix quickFix;

    public OnboardingController(OnboardingService service, OnboardingAiService ai, OnboardingQuickFix quickFix) {
        this.service = service;
        this.ai = ai;
        this.quickFix = quickFix;
    }

    /** Sửa nhanh theo luật (mã trùng / sai dạng, phòng viết khác / còn thiếu, năm, số lượng 0) — không cần AI. */
    @PostMapping("/{id}/quick-fixes")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingQuickFix.Result quickFixes(@PathVariable long id, @Valid @RequestBody SheetRequest body) {
        return quickFix.fixes(id, body.sheet());
    }

    @GetMapping("/ai")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public AiInfo aiInfo() {
        return new AiInfo(ai.available(), OnboardingAiService.SHEETS.stream().map(OnboardingSheet::key).toList(),
                OnboardingAiService.MAX_ROWS, OnboardingAiService.MAX_ROWS_PER_CLICK);
    }

    /** AI gợi ý sửa các dòng đã chọn — chỉ gợi ý, nhận thì đi qua PATCH /{id}/rows như sửa tay. */
    @PostMapping("/{id}/ai-suggest")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public List<OnboardingAiService.Suggestion> aiSuggest(@PathVariable long id, @Valid @RequestBody AiRequest body) {
        return ai.suggest(id, body.sheet(), body.rowIds());
    }

    @GetMapping
    @PreAuthorize("hasAuthority('data_imports:read')")
    public ResponseEntity<List<OnboardingService.Batch>> list(@RequestParam(name = "school.id", required = false) Long schoolId) {
        List<OnboardingService.Batch> batches = service.list(schoolId);
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(batches.size())).body(batches);
    }

    @GetMapping("/sheets")
    @PreAuthorize("hasAuthority('data_imports:read')")
    public List<OnboardingService.SheetInfo> sheets() {
        return service.sheets();
    }

    /** Tệp mẫu; {@code kind} = {@code schools} / {@code wards}: mẫu danh mục, vắng: dữ liệu đầu vào của trường. */
    @GetMapping("/template")
    @PreAuthorize("hasAuthority('data_imports:read')")
    public ResponseEntity<byte[]> template(@RequestParam(required = false) String kind) {
        if (kind != null && !"school_data".equals(kind)) {
            return file(service.catalogTemplate(kind), "Mẫu " + ("wards".equals(kind) ? "phường xã" : "danh sách trường") + ".xlsx");
        }
        return file(service.template(), "Mẫu dữ liệu đầu vào.xlsx");
    }

    @PostMapping
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingService.Batch upload(@RequestParam("file") MultipartFile file,
            @RequestParam(required = false) Long schoolId, @RequestParam(required = false) String kind,
            @RequestParam(defaultValue = "false") boolean deactivateMissing) {
        if (kind != null && !"school_data".equals(kind)) {
            return service.uploadCatalog(kind, fileName(file.getOriginalFilename()), bytes(file), deactivateMissing);
        }
        return service.upload(schoolId, fileName(file.getOriginalFilename()), bytes(file));
    }

    /** Lô danh mục: bật / tắt "ngừng mục không có trong tệp". */
    @PostMapping("/{id}/options")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingService.Batch options(@PathVariable long id, @RequestParam boolean deactivateMissing) {
        return service.setDeactivate(id, deactivateMissing);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('data_imports:read')")
    public OnboardingService.Batch get(@PathVariable long id) {
        return service.get(id);
    }

    @GetMapping("/{id}/rows")
    @PreAuthorize("hasAuthority('data_imports:read')")
    public List<OnboardingService.StagedRow> rows(@PathVariable long id, @RequestParam String sheet) {
        return service.rows(id, sheet);
    }

    /** Lịch sử sửa ô của lô — tab "Lịch sử". */
    @GetMapping("/{id}/edits")
    @PreAuthorize("hasAuthority('data_imports:read')")
    public List<OnboardingService.Edit> edits(@PathVariable long id) {
        return service.edits(id);
    }

    @PatchMapping("/{id}/rows/{rowId}")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingService.Batch updateRow(@PathVariable long id, @PathVariable long rowId,
            @Valid @RequestBody RowPatch patch) {
        return service.updateRow(id, rowId, patch.data(), patch.skipped());
    }

    /** Sửa nhiều dòng một lần (dán khối ô, kéo điền ở lưới) — kiểm lại cả lô một lần. */
    @PatchMapping("/{id}/rows")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingService.Batch updateRows(@PathVariable long id, @Valid @RequestBody RowEdits body) {
        return service.updateRows(id, body.edits());
    }

    @PostMapping("/{id}/rows")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingService.Batch addRow(@PathVariable long id, @Valid @RequestBody NewRow row) {
        return service.addRow(id, row.sheet(), row.data(), row.source());
    }

    /** Xoá hẳn các dòng khỏi lô — chỉ lô chưa ghi. */
    @PostMapping("/{id}/rows/delete")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingService.Batch deleteRows(@PathVariable long id, @Valid @RequestBody RowIds body) {
        return service.deleteRows(id, body.rowIds());
    }

    @PostMapping("/{id}/recheck")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingService.Batch recheck(@PathVariable long id) {
        return service.recheck(id);
    }

    @PostMapping("/{id}/commit")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingService.Batch commit(@PathVariable long id) {
        return service.commit(id);
    }

    /** Tiến độ lượt ghi đang chạy — màn hình hỏi mỗi giây khi đang chờ "Cập nhật". Không có lượt nào thì trả rỗng. */
    @GetMapping("/{id}/progress")
    @PreAuthorize("hasAuthority('data_imports:read')")
    public ResponseEntity<OnboardingService.Progress> progress(@PathVariable long id) {
        OnboardingService.Progress p = service.progress(id);
        return p == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(p);
    }

    @PostMapping("/{id}/rollback")
    @PreAuthorize("hasAuthority('data_imports:write')")
    public OnboardingService.Batch rollback(@PathVariable long id) {
        return service.rollback(id);
    }

    @GetMapping("/{id}/report")
    @PreAuthorize("hasAuthority('data_imports:read')")
    public ResponseEntity<byte[]> report(@PathVariable long id) {
        return file(service.errorReport(id), "Kết quả kiểm tra lô " + id + ".xlsx");
    }

    /** Giá trị chọn được cho từng ô của lô, theo trang → cột. */
    @GetMapping("/{id}/choices")
    @PreAuthorize("hasAuthority('data_imports:read')")
    public Map<String, Map<String, List<String>>> choices(@PathVariable long id) {
        return service.choices(id);
    }

    /** Dữ liệu đã chuẩn hoá, cùng khuôn tệp mẫu, không cột kết quả kiểm tra. */
    @GetMapping("/{id}/export")
    @PreAuthorize("hasAuthority('data_imports:read')")
    public ResponseEntity<byte[]> export(@PathVariable long id) {
        return file(service.cleanExport(id), "Dữ liệu đã chuẩn hoá lô " + id + ".xlsx");
    }

    /** Xoá lô chưa ghi. Trả lại thân rỗng có id — data provider đọc thân của mọi phản hồi xoá. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('data_imports:delete')")
    public Map<String, Object> delete(@PathVariable long id) {
        service.delete(id);
        return Map.of("id", id);
    }

    /** Tên tệp để lưu và hiện: bỏ đường dẫn, ký tự điều khiển, cắt vừa cột {@code file_name} (255). */
    private static String fileName(String original) {
        String name = original == null ? "" : original;
        name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
        name = name.replaceAll("\\p{Cntrl}", "").strip();
        if (name.isEmpty()) {
            return "tep-nhap.xlsx";
        }
        if (name.length() <= 255) {
            return name;
        }
        int dot = name.lastIndexOf('.');
        String ext = dot > 0 && name.length() - dot <= 10 ? name.substring(dot) : "";
        return name.substring(0, 255 - ext.length()) + ext;
    }

    private static byte[] bytes(MultipartFile file) {
        if (file.isEmpty()) {
            throw new FieldValidationException("file", "Chọn tệp để nhập");
        }
        if (file.getSize() > MAX_UPLOAD) {
            throw new FieldValidationException("file", "Tệp lớn hơn 10 MB — chia nhỏ ra");
        }
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp tải lên");
        }
    }

    private static ResponseEntity<byte[]> file(byte[] body, String name) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .contentType(XLSX)
                .body(body);
    }
}
