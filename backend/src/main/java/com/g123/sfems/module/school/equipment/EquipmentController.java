package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Hồ sơ thiết bị: năm endpoint chung của {@link CatalogController} (mã quyền {@code equipment:*}) cộng
 * lịch sử của một tài sản.
 */
@RestController
@RequestMapping("/api/equipment")
public class EquipmentController extends CatalogController<Equipment, EquipmentRequest, EquipmentPatchRequest> {

    private final EquipmentService equipment;
    private final RowLevelSecurity scopes;
    private final EquipmentSummaryService summary;

    public EquipmentController(EquipmentService service, RowLevelSecurity rowLevel, EquipmentSummaryService summary) {
        super(service, rowLevel);
        this.equipment = service;
        this.scopes = rowLevel;
        this.summary = summary;
    }

    /**
     * Số lượng thiết bị gộp theo nhóm thiết bị ({@code by=catalog}) hoặc theo kho/phòng ({@code by=room}),
     * tách theo trạng thái — hai chế độ Tổng hợp và Theo kho/phòng của màn Thiết bị, và cột lọc nhanh bên
     * trái. Phạm vi theo trường của người xem do máy chủ áp, không tin tham số.
     */
    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('equipment:read')")
    public Map<String, Object> summary(
            @RequestParam(defaultValue = "catalog") String by,
            @RequestParam(name = "school.id", required = false) Long schoolId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) String assetStatus,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) String q,
            @RequestParam(name = "_start", defaultValue = "0") int start,
            @RequestParam(name = "_end", defaultValue = "20") int end) {
        return summary.screen(
                "room".equalsIgnoreCase(by) ? EquipmentSummaryService.By.ROOM : EquipmentSummaryService.By.CATALOG,
                new EquipmentSummaryService.Filters(schoolId, type, subject, q, assetStatus, condition),
                start, Math.max(1, end - start));
    }

    /** Mã sẽ cấp, cho ô "Mã sẽ cấp" của form. {@code code} rỗng kèm {@code reason} khi chưa cấp được. */
    public record NextCodeResponse(String code, String reason) {
    }

    /**
     * Mã dự kiến cho form tạo mới, không tăng bộ đếm. Cũng dùng được cho người lập phiếu nhập (không cần
     * quyền sửa thiết bị) nên mở cho cả {@code equipment_intakes:write}.
     */
    @GetMapping("/next-code")
    @PreAuthorize("hasAnyAuthority('equipment:write', 'equipment_intakes:write')")
    public NextCodeResponse nextCode(
            @RequestParam Long catalogId,
            @RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) PhysicalDigitalType physicalOrDigital,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate receivedDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate purchaseDate) {
        EquipmentService.NextCode next =
                equipment.nextCode(schoolId, catalogId, physicalOrDigital, receivedDate, purchaseDate);
        return new NextCodeResponse(next.code(), next.reason());
    }

    /**
     * Tra cứu theo mã chuẩn hoặc mã cũ (TS-02). Trả mảng JSON trần như danh sách: thường 0 hoặc 1 phần tử;
     * nhiều hơn chỉ khi hai hồ sơ trùng mã cũ. Hồ sơ ngoài phạm vi không xuất hiện.
     */
    @GetMapping("/lookup")
    @PreAuthorize("hasAuthority('equipment:read')")
    public List<EquipmentResponse> lookup(@RequestParam String code) {
        return equipment.lookupByCode(code).stream()
                .map(item -> EquipmentResponse.from(item, scopes))
                .toList();
    }

    /** Cấp mã chuẩn cho tài sản đang mang mã cũ; mã cũ giữ lại ở {@code legacyCode} để tra tem cũ. */
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

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public List<EquipmentHistoryResponse> history(@PathVariable Long id) {
        return equipment.history(id).stream().map(EquipmentHistoryResponse::from).toList();
    }
}
