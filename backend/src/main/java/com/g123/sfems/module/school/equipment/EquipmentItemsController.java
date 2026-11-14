package com.g123.sfems.module.school.equipment;

import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.Set;

/**
 * {@code /api/equipment_items} — bảng CHI TIẾT của màn Thiết bị: tài sản từng cái và lô hàng
 * trong một danh sách, theo đúng dialect của data provider (mảng trần + {@code X-Total-Count}).
 * Chỉ đọc; sửa / xoá tài sản vẫn đi qua {@code /api/equipment/{id}}, lô thì không sửa tay được
 * (con số là hệ quả của phiếu). Cùng quyền {@code equipment:read} với danh sách thiết bị, cùng
 * phạm vi trường với màn tổng hợp ({@link EquipmentSummaryService}).
 */
@RestController
@RequestMapping("/api/equipment_items")
public class EquipmentItemsController {

    private static final Set<String> SORTABLE = Set.of("code", "name", "quantity", "status", "serialNumber", "room",
            "expiryDate", "inUseYear", "intake");

    private final EquipmentSummaryService summary;

    public EquipmentItemsController(EquipmentSummaryService summary) {
        this.summary = summary;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('equipment:read')")
    public ResponseEntity<List<Map<String, Object>>> list(@RequestParam MultiValueMap<String, String> raw) {
        ListParams params = new ListParams(raw);
        Pageable page = params.pageable(SORTABLE, Sort.unsorted());
        Sort.Order order = page.getSort().stream().findFirst().orElse(null);
        String profile = raw.getFirst("profileComplete");
        EquipmentSummaryService.ItemPage result = summary.items(
                new EquipmentSummaryService.Filters(
                        longOrNull(raw.getFirst("school.id")), raw.getFirst("schoolBody"), raw.getFirst("catalogType"),
                        longOrNull(raw.getFirst("catalogTree")), raw.getFirst("subject"), params.search().orElse(null),
                        null, raw.getFirst("assetStatus"), raw.getFirst("condition"), raw.getFirst("catalogScope")),
                new EquipmentSummaryService.ItemFilters(
                        raw.getFirst("kind"), longOrNull(raw.getFirst("catalog.id")), raw.getFirst("room.id"),
                        raw.getFirst("status"),
                        profile == null || profile.isBlank() ? null : Boolean.parseBoolean(profile),
                        raw.getFirst("legacyCode_like") != null ? raw.getFirst("legacyCode_like") : raw.getFirst("legacyCode"),
                        longOrNull(raw.getFirst("intake.id")), raw.getFirst("expiry"),
                        "true".equalsIgnoreCase(raw.getFirst("available")),
                        raw.getFirst("serial_like") != null ? raw.getFirst("serial_like") : raw.getFirst("serial"),
                        raw.getFirst("originSource.id") != null ? raw.getFirst("originSource.id")
                                : raw.getFirst("originSource"),
                        intOrNull(raw.getFirst("inUseYear") != null ? raw.getFirst("inUseYear") : raw.getFirst("inUseYear_like"))),
                (int) page.getOffset(), page.getPageSize(),
                order == null ? null : order.getProperty(), order != null && order.isDescending());
        return ListResponse.of(result.rows(), result.total());
    }

    private static Integer intOrNull(String v) {
        Long n = longOrNull(v);
        return n == null || n < 1900 || n > 2100 ? null : n.intValue();
    }

    private static Long longOrNull(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(v.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
