package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.catalog.norm.EquipmentNormService.SubjectGroup;
import com.g123.sfems.module.catalog.norm.EquipmentNormService.TopicOption;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable;
import com.g123.sfems.module.system.datachange.DataChangeResponse;
import com.g123.sfems.module.system.datachange.DataChangeService;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import org.springframework.http.HttpStatus;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** {@code /api/equipment_norms} — mã quyền {@code equipment_norms:*}. */
@RestController
@RequestMapping("/api/equipment_norms")
public class EquipmentNormController extends CatalogController<
        EquipmentNorm, EquipmentNormRequest, EquipmentNormPatchRequest> {

    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    private static final long MAX_UPLOAD = 10L * 1024 * 1024;

    private final EquipmentNormService norms;
    private final EquipmentNormExcel excel;
    private final EquipmentNormDocumentImport documents;
    private final DataChangeService dataChanges;

    public EquipmentNormController(EquipmentNormService service, RowLevelSecurity rowLevel, EquipmentNormExcel excel,
            EquipmentNormDocumentImport documents, DataChangeService dataChanges) {
        super(service, rowLevel);
        this.norms = service;
        this.excel = excel;
        this.documents = documents;
        this.dataChanges = dataChanges;
    }

    /**
     * {@code GET /api/equipment_norms/export.xlsx?standard.id=…} — mọi dòng khớp bộ lọc (cùng tham số
     * với danh sách: {@code subject.id}, {@code q}, {@code gradeLevel}, {@code target}, {@code topic},
     * {@code sectionName}), không phân trang, theo hình phụ lục.
     */
    @GetMapping("/export.xlsx")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public ResponseEntity<byte[]> export(@RequestParam MultiValueMap<String, String> query,
            @RequestParam("standard.id") Long standardId) {
        EquipmentNormExcel.Export file = excel.export(new ListParams(query), standardId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.filename(), StandardCharsets.UTF_8).build()
                                .toString())
                .contentType(XLSX)
                .body(file.body());
    }

    /**
     * {@code POST /api/equipment_norms/import} (multipart {@code file}, {@code standardId}) — nhập tệp
     * Excel vào một bộ NHÁP, tất cả hoặc không gì. Trả {@code {"created": n}}.
     */
    @PostMapping("/import")
    @PreAuthorize("hasAuthority(#root.this.authority('write'))")
    public Map<String, Integer> importFile(@RequestParam("file") MultipartFile file,
            @RequestParam("standardId") Long standardId) {
        if (file.isEmpty()) {
            throw new FieldValidationException("file", "Chọn tệp để nhập");
        }
        if (file.getSize() > MAX_UPLOAD) {
            throw new FieldValidationException("file", "Tệp tối đa 10 MB");
        }
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp tải lên");
        }
        return Map.of("created", excel.importFile(standardId, file.getOriginalFilename(), content));
    }

    /**
     * {@code GET /api/equipment_norms/groups?standard.id=…} — số dòng theo môn, cùng bộ lọc với
     * danh sách. Màn danh mục tối thiểu vẽ đầu nhóm từ đây và chỉ tải dòng của môn đang mở.
     */
    @GetMapping("/groups")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public List<SubjectGroup> groups(@RequestParam MultiValueMap<String, String> query) {
        return norms.groups(new ListParams(query));
    }

    /**
     * {@code POST /api/equipment_norms/import-document} (multipart {@code file} .docx, {@code standardId},
     * {@code dryRun}) — đọc phụ lục thông tư từ tệp Word. {@code dryRun=true}: chỉ đọc và so với bộ (Mới / Đổi /
     * Không đổi / Bỏ theo môn), không ghi gì — bộ nào cũng được. Không xem thử: THAY các môn có trong văn bản của
     * bộ NHÁP, tất cả hoặc không gì.
     */
    @PostMapping("/import-document")
    @PreAuthorize("hasAuthority(#root.this.authority('write'))")
    public EquipmentNormDocumentImport.Result importDocument(@RequestParam("file") MultipartFile file,
            @RequestParam("standardId") Long standardId,
            @RequestParam(value = "dryRun", defaultValue = "false") boolean dryRun) {
        if (file.isEmpty()) {
            throw new FieldValidationException("file", "Chọn tệp để đọc");
        }
        if (file.getSize() > MAX_UPLOAD) {
            throw new FieldValidationException("file", "Tệp tối đa 10 MB");
        }
        try {
            return documents.run(standardId, file.getOriginalFilename(), file.getBytes(), dryRun);
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp tải lên");
        }
    }

    /**
     * {@code PATCH /api/equipment_norms/batch} — sửa nhiều dòng một lần, tất cả hoặc không gì. Màn Ma trận
     * định mức lưu cả trăm dòng đổi "tính theo" bằng một yêu cầu thay vì một yêu cầu mỗi dòng (vấp giới
     * hạn tần suất). Trả {@code {"updated": n}}.
     */
    @PatchMapping("/batch")
    @PreAuthorize("hasAuthority(#root.this.authority('write'))")
    public Map<String, Integer> batch(@Valid @RequestBody EquipmentNormBatchRequest body) {
        return Map.of("updated", norms.updateAll(body.items()));
    }

    /** {@code POST /api/equipment_norms/{id}/remove} {@code {"legalDocument": {"id": …}}} — xoá khỏi danh mục theo văn bản. */
    @PostMapping("/{id}/remove")
    @PreAuthorize("hasAuthority(#root.this.authority('delete'))")
    public Object remove(@PathVariable Long id, @Valid @RequestBody RemoveRequest body) {
        return EquipmentNormResponse.from(norms.remove(id, body.legalDocument()), null);
    }

    /** Văn bản căn cứ của lần xoá. */
    public record RemoveRequest(IdRef legalDocument) {
    }

    /**
     * {@code POST /api/equipment_norms/{id}/stop} {@code {"legalDocument": {"id"}, "schoolYear": {"id"}}} — ngừng áp dụng
     * dòng từ một năm học theo văn bản căn cứ (dòng đã được trường dùng thì không xoá, chỉ ngừng).
     */
    @PostMapping("/{id}/stop")
    @PreAuthorize("hasAuthority(#root.this.authority('write'))")
    public Object stop(@PathVariable Long id, @Valid @RequestBody StopRequest body) {
        return EquipmentNormResponse.from(norms.stop(id, body.legalDocument(), body.schoolYear()), null);
    }

    /** Văn bản căn cứ và năm học bắt đầu ngừng. */
    public record StopRequest(@NotNull(message = "Chọn văn bản căn cứ") IdRef legalDocument,
            @NotNull(message = "Chọn năm học") IdRef schoolYear) {
    }

    /**
     * {@code GET /api/equipment_norms/{id}/usage} — {@code {"inUse": true}} khi thiết bị của dòng đã được trường dùng
     * (tài sản, phiếu, đề xuất, điều chỉnh…): khi đó không có nút Xoá, chỉ Ngừng áp dụng.
     */
    @GetMapping("/{id}/usage")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public Map<String, Boolean> usage(@PathVariable Long id) {
        return Map.of("inUse", norms.inUse(id));
    }

    /**
     * {@code GET /api/equipment_norms/adjustment-suggestion?note=…} — gợi ý điều chỉnh đọc từ ghi chú của phụ lục
     * ({@code kind} trống là không nhận ra câu nào). Chỉ là gợi ý: form có nút "Dùng gợi ý", không tự áp.
     */
    @GetMapping("/adjustment-suggestion")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public NormAdjustments.Suggestion suggestion(@RequestParam(value = "note", required = false) String note) {
        return NormAdjustments.suggest(note);
    }

    /** {@code GET /api/equipment_norms/adjust-groups?standard.id=…&subject.id=…} — nhóm "chọn trong nhóm" của một môn. */
    @GetMapping("/adjust-groups")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public List<EquipmentNormService.AdjustGroup> adjustGroups(@RequestParam("standard.id") Long standardId,
            @RequestParam(value = "subject.id", required = false) Long subjectId) {
        return norms.adjustGroups(standardId, subjectId);
    }

    /** {@code GET /api/equipment_norms/{id}/changes} — nhật ký của một dòng (thêm / sửa từng trường / xoá), mới trước. */
    @GetMapping("/{id}/changes")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public List<DataChangeResponse> changes(@PathVariable Long id) {
        return dataChanges.ofRecord("equipment_norms", id);
    }

    /** {@code GET /api/equipment_norms/topics?standard.id=…} — các lựa chọn của ô lọc Chủ đề. */
    @GetMapping("/topics")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public List<TopicOption> topics(@RequestParam("standard.id") Long standardId) {
        return norms.topics(standardId);
    }

    @Override
    protected String resource() {
        return "equipment_norms";
    }

    @Override
    protected Object respond(EquipmentNorm item, RowLevelSecurity rowLevel) {
        return EquipmentNormResponse.from(item, rowLevel);
    }

}
