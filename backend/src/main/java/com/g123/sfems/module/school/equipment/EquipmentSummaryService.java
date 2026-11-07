package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Màn Thiết bị dạng TỔNG HỢP SỐ LƯỢNG (TS-01, TS-02): mỗi dòng một nhóm thiết bị — hoặc một nhóm thiết bị
 * trong một kho/phòng — với số lượng tách theo trạng thái. Cột lọc nhanh bên trái (loại thiết bị, môn học)
 * cũng đếm từ đây, nên số bên trái và số trong bảng luôn cùng một nguồn.
 *
 * <p>Chỉ đếm tài sản CÒN TRÊN SỔ: tài sản đã thanh lý hay đã mất vẫn còn hồ sơ (lịch sử và phiếu trỏ tới
 * chúng) nhưng không còn là "trường đang có". Bảng Theo tài sản mới liệt kê cả chúng.
 *
 * <p>SQL thẳng thay vì JPA: một câu GROUP BY trả đủ các cột đếm, thay cho nạp từng tài sản lên bộ nhớ. Phạm
 * vi dữ liệu theo trường đi qua {@link VisibleSchools#sqlFilter} — chỉ ghép id số do máy chủ tính, mọi giá
 * trị người dùng gửi lên đều là tham số có tên.
 */
@Service
public class EquipmentSummaryService {

    /** Gộp theo nhóm thiết bị, hay theo kho/phòng rồi nhóm thiết bị. */
    public enum By {
        CATALOG,
        ROOM
    }

    /** Bộ lọc của màn — cùng tên với bộ lọc của danh sách {@code /api/equipment}. */
    public record Filters(Long schoolId, String type, String subject, String q, String statuses, String conditions) {
    }

    /** Trạng thái đã ra khỏi sổ: không đếm. */
    private static final Set<String> OFF_BOOK =
            EquipmentService.OFF_BOOK.stream().map(Enum::name).collect(Collectors.toSet());

    /**
     * Các cột đếm. "Dùng được" là còn trong kho hoặc đang dùng; "Hỏng" gồm đang chờ sửa và đang sửa;
     * "Chờ ghi giảm" là kiểm kê không thấy hoặc đang chờ thanh lý — còn trên sổ nhưng sắp ra khỏi sổ.
     */
    private static final String COUNTS = """
            COUNT(DISTINCT e.school_id) AS schools,
            SUM(e.quantity) AS total,
            COUNT(*) AS records,
            SUM(e.quantity) FILTER (WHERE e.status IN ('IN_STOCK', 'IN_USE')) AS usable,
            SUM(e.quantity) FILTER (WHERE e.status = 'IN_USE') AS in_use,
            SUM(e.quantity) FILTER (WHERE e.status = 'IN_STOCK') AS in_stock,
            SUM(e.quantity) FILTER (WHERE e.status IN ('BROKEN', 'REPAIRING')) AS broken,
            SUM(e.quantity) FILTER (WHERE e.status IN ('MISSING', 'PENDING_LIQUIDATION')) AS pending
            """;

    private static final String CATALOG_COLUMNS = """
            c.id AS catalog_id, c.code, c.name, c.tracking_type, c.minimum_required,
            u.name AS unit, sj.id AS subject_id, sj.name AS subject, t.id AS type_id, t.name AS type
            """;

    private static final String FROM = """
            FROM equipment e
            JOIN equipment_catalogs c ON c.id = e.catalog_id
            LEFT JOIN units u ON u.id = c.unit_id
            LEFT JOIN subjects sj ON sj.id = c.subject_id
            LEFT JOIN equipment_types t ON t.id = c.equipment_type_id
            JOIN schools s ON s.id = e.school_id
            LEFT JOIN rooms r ON r.id = e.room_id
            """;

    private final NamedParameterJdbcTemplate jdbc;
    private final VisibleSchools visibleSchools;

    public EquipmentSummaryService(NamedParameterJdbcTemplate jdbc, VisibleSchools visibleSchools) {
        this.jdbc = jdbc;
        this.visibleSchools = visibleSchools;
    }

    /**
     * Dữ liệu của màn. Theo nhóm thiết bị: trả đủ dòng (số nhóm thiết bị không lớn), phân trang ở máy khách.
     * Theo kho/phòng: phân trang ở MÁY CHỦ theo từng cặp trường × kho/phòng — một trang là N phòng, không
     * phải N dòng, để một phòng không bị cắt đôi giữa hai trang.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> screen(By by, Filters filters, int start, int size) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = where(filters, params);
        Map<String, Object> out = new LinkedHashMap<>();
        if (by == By.CATALOG) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT " + CATALOG_COLUMNS + ", " + COUNTS + FROM + where
                            + " GROUP BY c.id, u.name, sj.id, t.id ORDER BY c.name, c.code",
                    params);
            out.put("rows", rows);
            out.put("maxSchools", maxSchools(rows));
            return out;
        }

        // Theo kho/phòng: lấy trước một trang các cặp (trường, kho/phòng), rồi mới đếm cho đúng các cặp đó.
        // Kho (chưa xếp phòng) đứng đầu mỗi trường, sau đó là các phòng theo thứ tự hiển thị.
        String groups = """
                SELECT e.school_id, e.room_id, MIN(s.name) AS school_name, MIN(r.sort_order) AS room_order,
                       MIN(r.name) AS room_name
                """ + FROM + where + " GROUP BY e.school_id, e.room_id";
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM (" + groups + ") g", params, Long.class);
        params.addValue("start", Math.max(0, start)).addValue("size", Math.max(1, size));
        List<Map<String, Object>> page = jdbc.queryForList(groups
                + " ORDER BY school_name, e.school_id, e.room_id IS NOT NULL, room_order NULLS LAST, room_name"
                + " LIMIT :size OFFSET :start", params);

        List<Map<String, Object>> rows = new ArrayList<>();
        if (!page.isEmpty()) {
            StringBuilder pairs = new StringBuilder();
            for (int i = 0; i < page.size(); i++) {
                Map<String, Object> g = page.get(i);
                params.addValue("s" + i, g.get("school_id")).addValue("r" + i, g.get("room_id"));
                pairs.append(i == 0 ? "" : " OR ")
                        .append("(e.school_id = :s").append(i).append(" AND e.room_id IS NOT DISTINCT FROM CAST(:r")
                        .append(i).append(" AS BIGINT))");
            }
            rows = jdbc.queryForList(
                    "SELECT " + CATALOG_COLUMNS + ", e.school_id, s.name AS school, e.room_id,"
                            + " COALESCE(r.name, 'Kho (chưa xếp phòng)') AS room, MIN(r.sort_order) AS room_order, "
                            + COUNTS + FROM + where + " AND (" + pairs + ")"
                            + " GROUP BY c.id, u.name, sj.id, t.id, e.school_id, s.name, e.room_id, r.name"
                            + " ORDER BY s.name, e.school_id, e.room_id IS NOT NULL, room_order NULLS LAST, r.name, c.name",
                    params);
        }
        // Số kho/phòng và số tài sản của mỗi trường có trên trang, đếm trên CẢ danh sách — tiêu đề nhóm trường
        // không được nói "3 phòng" chỉ vì trang này chỉ chứa 3 phòng của trường đó.
        List<Map<String, Object>> schoolTotals = jdbc.queryForList(
                "SELECT e.school_id AS \"schoolId\", MIN(s.name) AS school,"
                        + " COUNT(DISTINCT COALESCE(e.room_id, 0)) AS rooms, COUNT(*) AS records "
                        + FROM + where + " GROUP BY e.school_id",
                params);
        out.put("rows", rows);
        out.put("maxSchools", schoolTotals.size());
        out.put("total", total == null ? 0 : total);
        out.put("schoolTotals", schoolTotals);
        return out;
    }

    /** Mệnh đề WHERE: còn trên sổ, trong phạm vi được xem, và các bộ lọc của màn. */
    private String where(Filters f, MapSqlParameterSource params) {
        StringBuilder sql = new StringBuilder(" WHERE e.status NOT IN (:offBook)")
                .append(visibleSchools.sqlFilter("e.school_id"));
        params.addValue("offBook", OFF_BOOK);
        if (f.schoolId() != null) {
            sql.append(" AND e.school_id = :schoolId");
            params.addValue("schoolId", f.schoolId());
        }
        appendRef(sql, params, "c.equipment_type_id", "typeId", f.type());
        appendRef(sql, params, "c.subject_id", "subjectId", f.subject());
        List<String> statuses = enumList(f.statuses(), AssetStatus.class);
        if (statuses != null) {
            sql.append(" AND e.status IN (:statuses)");
            params.addValue("statuses", statuses.isEmpty() ? List.of("") : statuses);
        }
        List<String> conditions = enumList(f.conditions(), EquipmentCondition.class);
        if (conditions != null) {
            sql.append(" AND e.condition IN (:conditions)");
            params.addValue("conditions", conditions.isEmpty() ? List.of("") : conditions);
        }
        if (f.q() != null && !f.q().isBlank()) {
            sql.append(" AND (c.name ILIKE :q OR c.code ILIKE :q OR e.name ILIKE :q OR e.code ILIKE :q)");
            params.addValue("q", "%" + f.q().trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
        }
        return sql.toString();
    }

    /** Lọc theo id, hoặc {@code none} là chưa gắn. Giá trị không phải số thì không khớp dòng nào. */
    private static void appendRef(StringBuilder sql, MapSqlParameterSource params, String column, String name,
            String raw) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        if ("none".equals(raw.trim())) {
            sql.append(" AND ").append(column).append(" IS NULL");
            return;
        }
        try {
            params.addValue(name, Long.valueOf(raw.trim()));
            sql.append(" AND ").append(column).append(" = :").append(name);
        } catch (NumberFormatException e) {
            sql.append(" AND FALSE");
        }
    }

    /**
     * Danh sách hằng enum từ chuỗi cách nhau bằng dấu phẩy, chỉ giữ hằng hợp lệ. {@code null} là không lọc;
     * danh sách rỗng là có lọc nhưng không giá trị nào hợp lệ — không khớp dòng nào.
     */
    private static <E extends Enum<E>> List<String> enumList(String raw, Class<E> type) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        Set<String> known = Arrays.stream(type.getEnumConstants()).map(Enum::name).collect(Collectors.toSet());
        return Arrays.stream(raw.split(",")).map(String::trim).filter(known::contains).toList();
    }

    private static long maxSchools(List<Map<String, Object>> rows) {
        return rows.stream().mapToLong(r -> ((Number) r.get("schools")).longValue()).max().orElse(0);
    }
}
