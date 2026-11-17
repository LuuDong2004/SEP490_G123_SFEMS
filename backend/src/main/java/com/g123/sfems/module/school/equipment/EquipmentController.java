package com.g123.sfems.module.school.equipment;

import com.g123.sfems.shared.web.HeavyQuery;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.procurement.AdequacyService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/equipment} — mã quyền {@code equipment:*}, phạm vi dòng theo trường. */
@RestController
@RequestMapping("/api/equipment")
public class EquipmentController extends CatalogController<Equipment, EquipmentRequest, EquipmentPatchRequest> {

    private final EquipmentCodeService codes;
    private final SchoolService schools;
    private final EquipmentCatalogService catalogs;
    private final RowLevelPrincipalResolver principals;
    private final EquipmentService equipment;
    private final RowLevelSecurity scopes;
    private final EquipmentSummaryService summary;
    private final AdequacyService adequacy;

    public EquipmentController(
            EquipmentService service,
            RowLevelSecurity rowLevel,
            EquipmentCodeService codes,
            SchoolService schools,
            EquipmentCatalogService catalogs,
            RowLevelPrincipalResolver principals,
            EquipmentSummaryService summary,
            AdequacyService adequacy) {
        super(service, rowLevel);
        this.adequacy = adequacy;
        this.summary = summary;
        this.codes = codes;
        this.schools = schools;
        this.catalogs = catalogs;
        this.principals = principals;
        this.equipment = service;
        this.scopes = rowLevel;
    }

    /**
     * Tổng hợp SỐ LƯỢNG theo mặt hàng ({@code by=catalog}) hoặc theo kho/phòng
     * ({@code by=room}) — xem {@link EquipmentSummaryService}. Cùng bộ lọc với danh sách
     * từng tài sản; khai trước {@code /{id}} nên đường dẫn chữ thắng biến đường dẫn.
     */
    @HeavyQuery
    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('equipment:read')")
    public Map<String, Object> summary(
            @RequestParam(defaultValue = "catalog") String by,
            @RequestParam(name = "school.id", required = false) Long schoolId,
            @RequestParam(required = false) String schoolBody,
            @RequestParam(required = false) String catalogType,
            @RequestParam(required = false) Long catalogTree,
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String assetStatus,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) String catalogScope,
            @RequestParam(required = false) Long campus,
            @RequestParam(name = "_start", defaultValue = "0") int start,
            @RequestParam(name = "_end", defaultValue = "20") int end) {
        // _start / _end chỉ có nghĩa với by=room: phân trang theo kho/phòng (xem EquipmentSummaryService.screen).
        return summary.screen(
                "room".equalsIgnoreCase(by) ? EquipmentSummaryService.By.ROOM : EquipmentSummaryService.By.CATALOG,
                new EquipmentSummaryService.Filters(schoolId, schoolBody, catalogType, catalogTree, subject, q, null,
                        assetStatus, condition, catalogScope, campus),
                start, end - start);
    }

    /** Bảng tổng hợp ở trên, ra tệp Excel — cùng tham số lọc. */
    @GetMapping("/summary.xlsx")
    @PreAuthorize("hasAuthority('equipment:read')")
    public ResponseEntity<byte[]> summaryExcel(
            @RequestParam(defaultValue = "catalog") String by,
            @RequestParam(name = "school.id", required = false) Long schoolId,
            @RequestParam(required = false) String schoolBody,
            @RequestParam(required = false) String catalogType,
            @RequestParam(required = false) Long catalogTree,
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) List<Long> schools,
            @RequestParam(required = false) String assetStatus,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) String catalogScope,
            @RequestParam(required = false) Long campus,
            @RequestParam(defaultValue = "false") boolean perSchool) {
        boolean byRoom = "room".equalsIgnoreCase(by);
        byte[] body = summary.excel(
                byRoom ? EquipmentSummaryService.By.ROOM : EquipmentSummaryService.By.CATALOG,
                new EquipmentSummaryService.Filters(schoolId, schoolBody, catalogType, catalogTree, subject, q, schools,
                        assetStatus, condition, catalogScope, campus),
                perSchool);
        String filename = byRoom ? "Thiết bị theo kho phòng.xlsx" : "Thiết bị tổng hợp.xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }

    /**
     * Tài sản này so với chuẩn: thiết bị của nó có thuộc danh mục tối thiểu (của cấp học của trường)
     * không, dòng phụ lục nào đòi, định mức trường phải có, đang có, còn thiếu. Đọc tài sản qua phạm
     * vi dòng trước, nên tài sản ngoài phạm vi là 404 như mọi đường đọc khác.
     */
    @GetMapping("/{id}/standard")
    @PreAuthorize("hasAuthority('equipment:read')")
    public AdequacyService.CatalogStandard standard(@PathVariable Long id) {
        Equipment item = equipment.get(id);
        return adequacy.forCatalog(item.getSchool().getId(), item.getCatalog().getId());
    }

    /** Cấp mã chuẩn TT.TR.MH.LT.ST.NC cho tài sản đang mang mã cũ; mã cũ giữ lại để tra cứu. */
    @PostMapping("/{id}/standard-code")
    @PreAuthorize("hasAuthority('equipment:write')")
    public Object standardCode(@PathVariable Long id) {
        return respond(equipment.standardizeCode(id), scopes);
    }

    @Override
    protected String resource() {
        return "equipment";
    }

    @Override
    protected Object respond(Equipment item, RowLevelSecurity rowLevel) {
        return EquipmentResponse.from(item, rowLevel);
    }

    /**
     * Mã gợi ý (không tăng bộ đếm) cho form tạo mới, và mã dự kiến trên từng dòng phiếu nhập —
     * nên người lập phiếu nhập (không cần quyền sửa thiết bị) cũng đọc được. {@code code} là {@code null}
     * khi thiếu dữ liệu để sinh mã — trường chưa có mã EMIS, môn chưa có mã dạy
     * học... — kèm {@code reason} để form nói cho người dùng biết vì sao.
     */
    @GetMapping("/next-code")
    @PreAuthorize("hasAnyAuthority('equipment:write', 'equipment_intakes:write')")
    public Map<String, String> nextCode(
            @RequestParam Long catalogId,
            @RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) PhysicalDigitalType physicalOrDigital,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate receivedDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate purchaseDate) {
        Map<String, String> body = new HashMap<>();
        Long sid = schoolId != null ? schoolId
                : principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        if (sid == null) {
            body.put("code", null);
            body.put("reason", "Chọn trường để sinh mã");
            return body;
        }
        School school = schools.get(sid);
        var parts = codes.parts(school, catalogs.get(catalogId), physicalOrDigital, receivedDate, purchaseDate);
        if (parts.isEmpty()) {
            body.put("code", null);
            body.put("reason", "Trường chưa có mã EMIS hoặc môn của nhóm thiết bị chưa có mã dạy học");
            return body;
        }
        String code = codes.peek(school, parts.get()).orElse(null);
        body.put("code", code);
        body.put("reason", code == null ? "Đã hết số thứ tự 001-999 cho bộ mã này" : null);
        return body;
    }
}
