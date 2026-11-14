package com.g123.sfems.module.report;

import com.g123.sfems.module.report.ReportService.Group;
import com.g123.sfems.module.report.ReportService.Params;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * Bộ lọc theo TÀI SẢN dùng chung cho các báo cáo về tài sản: loại thiết bị ({@code typeId}), trạng thái sử dụng
 * ({@code status}) và tình trạng kỹ thuật ({@code condition}). Báo cáo nào nhận bộ lọc nào khai ở {@link #BY_REPORT}
 * — màn báo cáo đọc danh sách đó ({@code Definition.filters}) để biết vẽ ô chọn nào; bộ lọc báo cáo không khai thì
 * bị gạt đi ({@link #only}), không lặng lẽ áp vào một truy vấn không có nghĩa với nó.
 *
 * <p>Áp qua {@link ReportService#assets}: phạm vi của người xem, rồi các điều kiện ở đây trên bí danh của bảng
 * {@code equipment} (hoặc một bảng có {@code catalog_id}, {@code status}, {@code condition} cùng nghĩa). Chỉ ghép
 * id số và khoá trong danh sách trắng — không ghép chuỗi người dùng gõ.
 */
public final class ReportFilters {

    /**
     * Một bộ lọc báo cáo nhận. {@code options} rỗng là danh sách lấy từ danh mục (loại thiết bị:
     * {@code /api/equipment_types}); có giá trị là danh sách cố định.
     */
    public record Filter(String key, String label, List<Group> options) {
    }

    /**
     * Trạng thái chọn được: khoá → các trạng thái gộp (SQL). Cũng là ô chọn của "Danh sách thiết bị theo trạng
     * thái". Nằm ở đây, không ở {@link ReportService}: lớp này không được đọc hằng của {@code ReportService} lúc
     * khởi tạo — {@code ReportService.DEFINITIONS} gọi {@link #of} khi chính nó đang khởi tạo.
     */
    static final Map<String, String> STATUS_SQL = new LinkedHashMap<>();

    static {
        STATUS_SQL.put("IN_STOCK", "'IN_STOCK'");
        STATUS_SQL.put("IN_USE", "'IN_USE'");
        STATUS_SQL.put("BORROWED", "'BORROWED'");
        STATUS_SQL.put("MAINTAINING", "'MAINTAINING'");
        STATUS_SQL.put("REPAIRING", "'REPAIRING', 'WARRANTY'");
        STATUS_SQL.put("BROKEN", "'BROKEN', 'MISSING'");
        STATUS_SQL.put("UNREPAIRABLE", "'UNREPAIRABLE'");
        STATUS_SQL.put("PENDING_LIQUIDATION", "'PENDING_LIQUIDATION'");
        STATUS_SQL.put("PENDING_DESTRUCTION", "'PENDING_DESTRUCTION'");
        STATUS_SQL.put("TRANSFERRING", "'TRANSFERRING'");
    }

    static final List<Group> STATUS_CHOICES = List.of(
            new Group("IN_STOCK", "Trong kho"), new Group("IN_USE", "Đang sử dụng"),
            new Group("BORROWED", "Đang cho mượn"), new Group("MAINTAINING", "Đang bảo trì"),
            new Group("REPAIRING", "Đang sửa chữa, bảo hành"), new Group("BROKEN", "Hỏng, báo mất"),
            new Group("UNREPAIRABLE", "Hỏng, không sửa được"),
            new Group("PENDING_LIQUIDATION", "Chờ thanh lý"),
            new Group("PENDING_DESTRUCTION", "Chờ tiêu huỷ"),
            new Group("TRANSFERRING", "Đang điều chuyển"));

    /** Tình trạng kỹ thuật chọn được: khoá → điều kiện SQL (trên {@code <bí danh>.condition}). */
    private static final Map<String, String> CONDITIONS = new LinkedHashMap<>();

    static {
        CONDITIONS.put("TOT", "= 'TOT'");
        CONDITIONS.put("TRUNG_BINH", "= 'TRUNG_BINH'");
        CONDITIONS.put("KEM", "= 'KEM'");
        CONDITIONS.put("HONG", "= 'HONG'");
        CONDITIONS.put("NONE", "IS NULL");
    }

    private static final List<Group> CONDITION_CHOICES = List.of(new Group("TOT", "Tốt"),
            new Group("TRUNG_BINH", "Trung bình"), new Group("KEM", "Kém"), new Group("HONG", "Hỏng"),
            new Group("NONE", "Chưa đánh giá"));

    static final Filter TYPE = new Filter("type", "Loại thiết bị", List.of());
    static final Filter STATUS = new Filter("status", "Trạng thái", STATUS_CHOICES);
    static final Filter CONDITION = new Filter("condition", "Tình trạng", CONDITION_CHOICES);

    /**
     * Báo cáo → bộ lọc nó nhận. Báo cáo đã CHIA CỘT theo trạng thái (hoặc tình trạng) thì không nhận lọc theo chính
     * thứ đó: lọc xong chỉ còn một cột khác 0.
     */
    private static final Map<String, List<Filter>> BY_REPORT = Map.ofEntries(
            Map.entry("equipment-by-school", List.of(TYPE, STATUS, CONDITION)),
            Map.entry("equipment-by-catalog", List.of(TYPE, STATUS, CONDITION)),
            Map.entry("equipment-by-status", List.of(TYPE, CONDITION)),
            Map.entry("equipment-by-condition", List.of(TYPE, STATUS)),
            Map.entry("equipment-list", List.of(TYPE, CONDITION)),
            Map.entry("equipment-ledger", List.of(TYPE, STATUS, CONDITION)),
            Map.entry("broken-equipment", List.of(TYPE)),
            Map.entry("unused-equipment", List.of(TYPE)),
            Map.entry("idle-equipment", List.of(TYPE, CONDITION)),
            Map.entry("data-quality", List.of(TYPE, STATUS)),
            Map.entry("data-anomalies", List.of(TYPE)),
            Map.entry("supply-consumption", List.of(TYPE)),
            Map.entry("supply-expiry", List.of(TYPE)));

    private ReportFilters() {
    }

    static List<Filter> of(String report) {
        return BY_REPORT.getOrDefault(report, List.of());
    }

    /** Bỏ các bộ lọc báo cáo không nhận, và giá trị nằm ngoài danh sách trắng. */
    static Params only(Params p, List<Filter> filters) {
        boolean type = filters.contains(TYPE);
        boolean status = filters.contains(STATUS) && p.status() != null
                && STATUS_SQL.containsKey(p.status());
        boolean condition = filters.contains(CONDITION) && p.condition() != null
                && CONDITIONS.containsKey(p.condition());
        return new Params(p.from(), p.to(), p.year(), p.bodyId(), p.levelId(), p.schoolId(), p.group(), p.choice(),
                type ? p.typeId() : null, status ? p.status() : null, condition ? p.condition() : null);
    }

    /** Điều kiện SQL của các bộ lọc đang chọn, trên bí danh cho trước. Luôn có khoảng trắng hai đầu. */
    static String sql(String alias, Params p) {
        StringBuilder sql = new StringBuilder(" ");
        if (p.typeId() != null) {
            sql.append(" AND ").append(alias).append(".catalog_id IN (SELECT ftc.id FROM equipment_catalogs ftc")
                    .append(" WHERE ftc.equipment_type_id = ").append(p.typeId().longValue()).append(") ");
        }
        String statuses = p.status() == null ? null : STATUS_SQL.get(p.status());
        if (statuses != null) {
            sql.append(" AND ").append(alias).append(".status IN (").append(statuses).append(") ");
        }
        String condition = p.condition() == null ? null : CONDITIONS.get(p.condition());
        if (condition != null) {
            sql.append(" AND ").append(alias).append(".condition ").append(condition).append(' ');
        }
        return sql.toString();
    }

    /** Nhãn của các bộ lọc đang chọn (trừ loại thiết bị — tên loại tra trong danh mục), cho phụ đề. */
    static List<String> labels(Params p) {
        String status = STATUS_CHOICES.stream().filter(g -> g.key().equals(p.status()))
                .map(Group::label).findFirst().orElse(null);
        String condition = CONDITION_CHOICES.stream().filter(g -> g.key().equals(p.condition()))
                .map(Group::label).findFirst().orElse(null);
        return Stream.of(status, condition == null ? null : "Tình trạng " + condition.toLowerCase())
                .filter(Objects::nonNull).toList();
    }
}
