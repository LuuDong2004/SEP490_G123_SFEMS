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

    /** {@code schools=1,2,3}: xuất Excel "chọn trường" của màn Thiết bị. Trống = không lọc thêm. */
    private static List<Long> schoolList(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return java.util.Arrays.stream(raw.split(",")).map(String::trim).filter(s -> s.matches("\\d+"))
                .map(Long::valueOf).toList();
    }

    @GetMapping
    @PreAuthorize("hasAuthority('equipment:read')")
    public ResponseEntity<List<Map<String, Object>>> list(@RequestParam MultiValueMap<String, String> raw) {
        ListParams params = new ListParams(raw);
        Pageable page = params.pageable(SORTABLE, Sort.unsorted());
        Sort.Order order = page.getSort().stream().findFirst().orElse(null);
        EquipmentSummaryService.ItemPage result = summary.items(filtersOf(raw, params), itemFiltersOf(raw),
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

    private static EquipmentSummaryService.Filters filtersOf(MultiValueMap<String, String> raw, ListParams params) {
        return new EquipmentSummaryService.Filters(
                        longOrNull(raw.getFirst("school.id")), raw.getFirst("schoolBody"), raw.getFirst("catalogType"),
                        longOrNull(raw.getFirst("catalogTree")), raw.getFirst("subject"), params.search().orElse(null),
                        schoolList(raw.getFirst("schools")), raw.getFirst("assetStatus"), raw.getFirst("condition"), raw.getFirst("catalogScope"),
                        longOrNull(raw.getFirst("campus")));
    }

    private static EquipmentSummaryService.ItemFilters itemFiltersOf(MultiValueMap<String, String> raw) {
        String profile = raw.getFirst("profileComplete");
        return new EquipmentSummaryService.ItemFilters(
                        raw.getFirst("kind"), longOrNull(raw.getFirst("catalog.id")), raw.getFirst("room.id"),
                        raw.getFirst("status"),
                        profile == null || profile.isBlank() ? null : Boolean.parseBoolean(profile),
                        raw.getFirst("legacyCode_like") != null ? raw.getFirst("legacyCode_like") : raw.getFirst("legacyCode"),
                        longOrNull(raw.getFirst("intake.id")), raw.getFirst("expiry"),
                        "true".equalsIgnoreCase(raw.getFirst("available")),
                        raw.getFirst("serial_like") != null ? raw.getFirst("serial_like") : raw.getFirst("serial"),
                        raw.getFirst("originSource.id") != null ? raw.getFirst("originSource.id")
                                : raw.getFirst("originSource"),
                        intOrNull(raw.getFirst("inUseYear") != null ? raw.getFirst("inUseYear") : raw.getFirst("inUseYear_like")));
    }

    /** Cột xuất được của bảng Từng thiết bị: id cột trên màn → tiêu đề, kiểu, cách lấy giá trị từ một dòng. */
    private record Col(String label, String type, java.util.function.Function<Map<String, Object>, Object> value) {
    }

    private static Object nameOf(Object o) {
        return o instanceof Map<?, ?> m ? m.get("name") : null;
    }

    private static final Map<String, String> STATUS = Map.of("IN_STOCK", "Trong kho", "IN_USE", "Đang dùng");

    private static final Map<String, Col> COLUMNS = new java.util.LinkedHashMap<>();

    static {
        COLUMNS.put("code", new Col("Mã thiết bị", "text", r -> r.get("code")));
        COLUMNS.put("name", new Col("Thiết bị", "text", r -> r.get("name")));
        COLUMNS.put("serialNumber", new Col("Số serial", "text", r -> r.get("serialNumber")));
        COLUMNS.put("room", new Col("Vị trí", "text", r -> nameOf(r.get("room"))));
        COLUMNS.put("campus", new Col("Cơ sở", "text", r -> nameOf(r.get("campus"))));
        COLUMNS.put("quantity", new Col("SL", "number", r -> r.get("quantity")));
        COLUMNS.put("status", new Col("Trạng thái", "text",
                r -> STATUS.getOrDefault(String.valueOf(r.get("status")), String.valueOf(r.get("status")))));
        COLUMNS.put("expiryDate", new Col("Hạn sử dụng", "text", r -> r.get("expiryDate")));
        COLUMNS.put("intake", new Col("Phiếu ghi tăng", "text",
                r -> r.get("intake") instanceof Map<?, ?> m ? m.get("code") : null));
        COLUMNS.put("profileComplete", new Col("Hồ sơ", "text",
                r -> Boolean.FALSE.equals(r.get("profileComplete")) ? "Chưa chuẩn" : "Chuẩn"));
        COLUMNS.put("originSource", new Col("Nguồn hình thành", "text", r -> nameOf(r.get("originSource"))));
        COLUMNS.put("inUseYear", new Col("Năm sử dụng", "number", r -> r.get("inUseYear")));
        COLUMNS.put("school", new Col("Trường", "text", r -> nameOf(r.get("school"))));
    }

    /**
     * Tệp Excel của bảng Từng thiết bị — GHI DẠNG LUỒNG: đọc từng khúc {@value #CHUNK} dòng và ghi thẳng ra phản hồi, bộ
     * nhớ không phình theo số dòng (toàn ngành hàng trăm nghìn hồ sơ). Cùng bộ lọc với danh sách; {@code cols} là các
     * cột đang hiện trên màn (theo thứ tự), {@code schools} là các trường đã chọn. Xếp theo trường để các dòng của một
     * trường đứng liền nhau.
     */
    @GetMapping("/export.xlsx")
    @PreAuthorize("hasAuthority('equipment:read')")
    public ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody> export(
            @RequestParam MultiValueMap<String, String> raw) {
        ListParams params = new ListParams(raw);
        EquipmentSummaryService.Filters filters = filtersOf(raw, params);
        EquipmentSummaryService.ItemFilters items = itemFiltersOf(raw);
        String wanted = raw.getFirst("cols");
        List<String> ids = (wanted == null || wanted.isBlank() ? List.copyOf(COLUMNS.keySet())
                : java.util.Arrays.stream(wanted.split(",")).map(String::trim).filter(COLUMNS::containsKey).toList());
        List<Col> cols = ids.stream().map(COLUMNS::get).toList();
        List<com.g123.sfems.shared.office.XlsxWriter.Column> header = new java.util.ArrayList<>();
        for (int i = 0; i < cols.size(); i++) {
            header.add(new com.g123.sfems.shared.office.XlsxWriter.Column("c" + i, cols.get(i).label(), cols.get(i).type()));
        }
        String subtitle = raw.getFirst("subtitle") == null ? "" : raw.getFirst("subtitle");
        org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody body = out -> {
            try (var sheet = com.g123.sfems.shared.office.XlsxWriter.stream(out, "Danh sách thiết bị", subtitle, header)) {
                for (int start = 0; sheet.rows() < com.g123.sfems.shared.office.XlsxWriter.MAX_DATA_ROWS; start += CHUNK) {
                    EquipmentSummaryService.ItemPage page = summary.items(filters, items, start, CHUNK, "school", false);
                    for (Map<String, Object> r : page.rows()) {
                        sheet.row(cols.stream().map(col -> col.value().apply(r)).toArray());
                    }
                    if (page.rows().size() < CHUNK) {
                        break;
                    }
                }
            }
        };
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        org.springframework.http.ContentDisposition.attachment()
                                .filename("Danh sách thiết bị.xlsx", java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .contentType(org.springframework.http.MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }

    private static final int CHUNK = 1000;

}
