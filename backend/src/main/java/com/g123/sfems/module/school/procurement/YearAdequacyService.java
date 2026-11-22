package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.equipment.EquipmentLifecycle;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.module.school.procurement.AdequacyService.Context;
import com.g123.sfems.module.school.procurement.AdequacyService.Requirement;
import com.g123.sfems.module.school.procurement.AdequacyService.School;
import com.g123.sfems.module.school.procurement.AdequacyService.SchoolClass;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chuẩn tối thiểu THEO NĂM HỌC, theo TỪNG ĐIỂM TRƯỜNG (docs/du-lieu-theo-nam-hoc.md §2.B, §7, §8 bước 2–4).
 *
 * <p>Khác {@link AdequacyService} (số "dùng được" của hôm nay, cả trường) ở ba chỗ:
 * <ul>
 *   <li><b>Năm học:</b> lớp, sĩ số của năm đó; giáo viên theo PHÂN CÔNG của năm đó (277); thiết bị TẠI NGÀY CẮT
 *       ({@code school_years.end_date}, năm hiện tại là lúc này) dựng lại từ {@code equipment_history}. Phòng theo hiện
 *       trạng (loại B, không có lịch sử theo năm).</li>
 *   <li><b>Đang có:</b> mọi thiết bị đã ghi tăng, còn trên sổ tại ngày cắt — KỂ CẢ hỏng, mất (tách cột); trừ thiết bị
 *       đang nằm trên đề nghị ghi giảm đã trình mà chưa hoàn tất (cột "chờ ghi giảm", §7).</li>
 *   <li><b>Điểm trường:</b> mỗi điểm tính đủ / thiếu riêng; tổng trường là CỘNG các điểm — thừa điểm này không bù thiếu
 *       điểm kia (§7).</li>
 * </ul>
 * Thiết bị thuộc điểm trường theo phòng hiện tại của nó (không phòng → cơ sở chính); thiết bị đã điều chuyển sang
 * trường khác sau ngày cắt tính cho trường cũ (cơ sở chính của trường cũ).
 */
@Service
@Transactional(readOnly = true)
public class YearAdequacyService {

    static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Đã ra khỏi sổ — không đếm. */
    static final Set<AssetStatus> OFF_BOOKS = Set.of(AssetStatus.LIQUIDATED, AssetStatus.DESTROYED, AssetStatus.LOST,
            AssetStatus.NOT_DELIVERED, AssetStatus.USED_UP);
    /** Chờ ghi giảm theo trạng thái (đề nghị thanh lý / tiêu huỷ đang mở) — không đếm, cột riêng. */
    static final Set<AssetStatus> PENDING_STATUSES = Set.of(AssetStatus.PENDING_LIQUIDATION,
            AssetStatus.PENDING_DESTRUCTION);
    static final Set<AssetStatus> BROKEN = Set.of(AssetStatus.BROKEN, AssetStatus.UNREPAIRABLE, AssetStatus.REPAIRING,
            AssetStatus.WARRANTY);
    static final Set<AssetStatus> LOST = Set.of(AssetStatus.MISSING);

    private final JdbcTemplate jdbc;
    private final VisibleSchools visibleSchools;
    private final List<AdjustmentSource> adjustmentSources;

    public YearAdequacyService(JdbcTemplate jdbc, VisibleSchools visibleSchools,
            List<AdjustmentSource> adjustmentSources) {
        this.jdbc = jdbc;
        this.visibleSchools = visibleSchools;
        this.adjustmentSources = adjustmentSources;
    }

    // ------------------------------------------------------------------ kiểu dữ liệu

    public record Year(Long id, String code, String name, LocalDate start, LocalDate end, boolean current) {

        /** Ngày cắt: cuối ngày kết thúc năm học; năm hiện tại là lúc này. */
        Instant cutoff() {
            return current ? Instant.now() : end.plusDays(1).atStartOfDay(VN).toInstant();
        }
    }

    public record CampusRef(Long id, String name, boolean primary) {
    }

    /** Điều chỉnh của trường áp lên một dòng (bước 3) — số "theo điều chỉnh" tính từ nó. */
    public record Adjustment(Long id, String kind, String status, String reason, Boolean chosen, Integer outsideNeed,
            boolean substituteConfirmed, String expiredReason, String updatedAt, String updatedBy) {
    }

    /** Nguồn điều chỉnh của trường (bảng 279 cài); không có bean nào thì không có điều chỉnh. */
    public interface AdjustmentSource {
        /** (trường → (cơ sở hoặc 0 → (norm → điều chỉnh))). */
        Map<Long, Map<Long, Map<Long, Adjustment>>> load(Set<Long> schoolIds, Long yearId);
    }

    /** Một thiết bị ở một điểm trường (hoặc cộng cả trường khi {@code campusId == null} và là dòng tổng). */
    public record Row(Long catalogId, String catalogCode, Long normId, String normCode, String name, String subjectName,
            String unitName, Long campusId, String campusName, String allowedKind, String basisText, String allowedText,
            Integer requiredTt,
            Integer requiredAdjusted, int current, int broken, int lost, int pendingDisposal, Integer shortageTt,
            Integer shortageAdjusted, Integer surplus, Integer outsideNeed, int proposed, String warning,
            Adjustment adjustment) {
    }

    public record Totals(int counted, int metTt, int metAdjusted, int percentTt, int percentAdjusted, int shortageTt,
            int shortageAdjusted, int adjusted, int outside, int unhandled) {
    }

    /** Kết quả một trường một năm: dòng của từng điểm trường và dòng cộng cả trường. */
    public record SchoolYearResult(Long schoolId, String schoolCode, String schoolName, String levelCode,
            String levelName, boolean hasEquipment, Year year, List<CampusRef> campuses, List<Row> campusRows,
            List<Row> totalRows) {

        public List<Row> rowsOf(Long campusId) {
            if (campusId == null) {
                return totalRows;
            }
            return campusRows.stream().filter(r -> Objects.equals(r.campusId(), campusId)).toList();
        }

        public Totals totals(Long campusId) {
            return YearAdequacyService.totals(rowsOf(campusId));
        }
    }

    // ------------------------------------------------------------------ đọc

    public Year year(Long yearId) {
        String where = yearId == null ? "is_current" : "id = ?";
        Object[] args = yearId == null ? new Object[0] : new Object[] {yearId};
        return jdbc.query("SELECT id, code, name, start_date, end_date, is_current FROM school_years WHERE " + where,
                (rs, i) -> new Year(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getObject(4, LocalDate.class),
                        rs.getObject(5, LocalDate.class), rs.getBoolean(6)), args).stream().findFirst()
                .orElseThrow(() -> new FieldValidationException("schoolYear",
                        yearId == null ? "Chưa đặt năm học hiện tại" : "Năm học không có trong danh mục"));
    }

    /** Một trường — trong phạm vi người xem. */
    public SchoolYearResult forSchool(Long schoolId, Long yearId) {
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(schoolId)) {
            throw new ResourceNotFoundException("School", schoolId);
        }
        Map<Long, SchoolYearResult> out = compute(Set.of(schoolId), year(yearId));
        SchoolYearResult r = out.get(schoolId);
        if (r == null) {
            throw new ResourceNotFoundException("School", schoolId);
        }
        return r;
    }

    /** Trường trong phạm vi người xem, không thì 404. */
    public void requireVisible(Long schoolId) {
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(schoolId)) {
            throw new ResourceNotFoundException("School", schoolId);
        }
    }

    /** Tính cho một tập trường (không kiểm phạm vi — nơi gọi đã lọc). */
    public Map<Long, SchoolYearResult> compute(Set<Long> schoolIds, Year year) {
        Map<Long, SchoolYearResult> out = new LinkedHashMap<>();
        if (schoolIds.isEmpty()) {
            return out;
        }
        String ids = schoolIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        Timestamp cut = Timestamp.from(year.cutoff());

        record SchoolInfo(Long id, String code, String name, String levelCode, String levelName, String district) {
        }
        List<SchoolInfo> schools = jdbc.query("""
                SELECT s.id, s.code, s.name, lv.code AS level_code, lv.name AS level_name,
                       COALESCE(w.name, NULLIF(s.ward_text, ''), s.district) AS district
                FROM schools s JOIN education_levels lv ON lv.id = s.education_level_id
                LEFT JOIN wards w ON w.id = s.ward_id
                WHERE s.id IN (%s) ORDER BY s.name""".formatted(ids),
                (rs, i) -> new SchoolInfo(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getString(6)));

        // Điểm trường còn dùng; trường chưa khai cơ sở nào thì một "điểm" không id.
        Map<Long, List<CampusRef>> campuses = new HashMap<>();
        jdbc.query("SELECT school_id, id, name, is_primary FROM campuses WHERE active AND school_id IN (" + ids
                + ") ORDER BY is_primary DESC, sort_order NULLS LAST, name", rs -> {
            campuses.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>())
                    .add(new CampusRef(rs.getLong(2), rs.getString(3), rs.getBoolean(4)));
        });

        // Lớp của năm học, theo cơ sở của phòng học.
        Map<Long, Map<Long, List<SchoolClass>>> classes = new HashMap<>();
        jdbc.query("""
                SELECT k.school_id, %s AS campus_id, g.code AS grade, k.student_count
                FROM school_classes k JOIN grades g ON g.id = k.grade_id
                WHERE k.active AND k.school_year_id = ? AND k.school_id IN (%s)""".formatted(
                FacilityCounting.campusOfRoomSql("k.room_id", "k.school_id"), ids), rs -> {
            Integer grade = AdequacyService.gradeNumber(rs.getString("grade"));
            if (grade != null) {
                classes.computeIfAbsent(rs.getLong("school_id"), k -> new HashMap<>())
                        .computeIfAbsent(key(rs.getObject("campus_id")), k -> new ArrayList<>())
                        .add(new SchoolClass(grade, (Integer) rs.getObject("student_count")));
            }
        }, year.id());

        // Giáo viên theo môn, theo phân công của năm học (năm hiện tại: chỉ người đang làm việc).
        String campusOfAssignment = "(SELECT " + FacilityCounting.EFFECTIVE_CAMPUS + " FROM (SELECT 1) one"
                + FacilityCounting.campusJoins("a.campus_id", "a.school_id") + ")";
        String activeOnly = year.current() ? " AND st.active" : "";
        Map<Long, Map<Long, Map<Long, Integer>>> teachers = new HashMap<>();
        jdbc.query("""
                SELECT a.school_id, %s AS campus_id, x.subject_id, count(DISTINCT a.staff_id) AS n
                FROM staff_assignments a JOIN staff st ON st.id = a.staff_id
                JOIN (SELECT id AS assignment_id, main_subject_id AS subject_id FROM staff_assignments
                      WHERE main_subject_id IS NOT NULL
                      UNION SELECT assignment_id, subject_id FROM staff_assignment_subjects) x ON x.assignment_id = a.id
                WHERE a.school_year_id = ? AND st.staff_type = 'TEACHER'%s AND a.school_id IN (%s)
                GROUP BY 1, 2, 3""".formatted(campusOfAssignment, activeOnly, ids), rs -> {
            teachers.computeIfAbsent(rs.getLong(1), k -> new HashMap<>())
                    .computeIfAbsent(key(rs.getObject(2)), k -> new HashMap<>()).put(rs.getLong(3), rs.getInt(4));
        }, year.id());
        Map<Long, Map<Long, Integer>> allTeachers = new HashMap<>();
        jdbc.query("""
                SELECT a.school_id, %s AS campus_id, count(*) FROM staff_assignments a JOIN staff st ON st.id = a.staff_id
                WHERE a.school_year_id = ? AND st.staff_type = 'TEACHER'%s AND a.school_id IN (%s)
                GROUP BY 1, 2""".formatted(campusOfAssignment, activeOnly, ids), rs -> {
            allTeachers.computeIfAbsent(rs.getLong(1), k -> new HashMap<>()).put(key(rs.getObject(2)), rs.getInt(3));
        }, year.id());

        // Phòng bộ môn theo môn — hiện trạng (phòng là dữ liệu liên tục).
        Map<Long, Map<Long, Map<Long, Integer>>> rooms = new HashMap<>();
        jdbc.query("""
                SELECT r.school_id, rc.campus_id, r.subject_id, count(*) FROM rooms r
                JOIN (%s) rc ON rc.room_id = r.id
                WHERE %s AND r.subject_id IS NOT NULL AND r.school_id IN (%s)
                GROUP BY 1, 2, 3""".formatted(FacilityCounting.ROOM_CAMPUS, FacilityCounting.COUNTED_ROOM, ids), rs -> {
            rooms.computeIfAbsent(rs.getLong(1), k -> new HashMap<>())
                    .computeIfAbsent(key(rs.getObject(2)), k -> new HashMap<>()).put(rs.getLong(3), rs.getInt(4));
        });

        Map<Long, Map<Long, Map<Long, int[]>>> stock = equipmentAt(ids, year, cut);
        Map<Long, Map<Long, Integer>> proposed = new HashMap<>();
        jdbc.query("""
                SELECT p.school_id, l.catalog_id, SUM(l.quantity)::int FROM purchase_proposals p
                JOIN purchase_proposal_lines l ON l.proposal_id = p.id
                WHERE p.status IN ('DRAFT', 'PENDING', 'APPROVED', 'COMPLETED') AND p.intake_id IS NULL AND p.school_id IN (%s)
                GROUP BY 1, 2""".formatted(ids), rs -> {
            proposed.computeIfAbsent(rs.getLong(1), k -> new HashMap<>()).put(rs.getLong(2), rs.getInt(3));
        });

        Map<String, List<Map<String, Object>>> norms = normsFor(year);
        Map<Long, Map<Long, Map<Long, Adjustment>>> adjustments = new HashMap<>();
        for (AdjustmentSource source : adjustmentSources) {
            adjustments.putAll(source.load(schoolIds, year.id()));
        }
        Map<Long, Set<Long>> shared = sharedCatalogs();

        for (SchoolInfo s : schools) {
            List<CampusRef> own = campuses.getOrDefault(s.id(), List.of());
            if (own.isEmpty()) {
                own = List.of(new CampusRef(null, "Trường chính", true));
            }
            School school = new School(s.id(), s.code(), s.name(), s.levelName(), s.levelCode(), s.district(), null,
                    null);
            int[] grades = AdequacyService.LEVEL_GRADES.getOrDefault(s.levelCode(), new int[0]);
            List<Row> campusRows = new ArrayList<>();
            Map<Long, Map<Long, int[]>> ownStock = stock.getOrDefault(s.id(), Map.of());
            boolean hasEquipment = ownStock.values().stream().anyMatch(m -> !m.isEmpty());
            Map<Long, Map<Long, Adjustment>> ownAdj = adjustments.getOrDefault(s.id(), Map.of());
            for (CampusRef c : own) {
                long ck = c.id() == null ? 0L : c.id();
                Context ctx = new Context(school, classes.getOrDefault(s.id(), Map.of()).getOrDefault(ck, List.of()),
                        grades, teachers.getOrDefault(s.id(), Map.of()).getOrDefault(ck, Map.of()),
                        allTeachers.getOrDefault(s.id(), Map.of()).getOrDefault(ck, 0),
                        rooms.getOrDefault(s.id(), Map.of()).getOrDefault(ck, Map.of()));
                Map<Long, int[]> have = ownStock.getOrDefault(ck, Map.of());
                Map<Long, Integer> prop = c.primary() ? proposed.getOrDefault(s.id(), Map.of()) : Map.of();
                campusRows.addAll(campusRows(norms.getOrDefault(s.levelCode(), List.of()), ctx, c, have, prop,
                        ownAdj.getOrDefault(ck, Map.of()), shared));
            }
            out.put(s.id(), new SchoolYearResult(s.id(), s.code(), s.name(), s.levelCode(), s.levelName(),
                    hasEquipment, year, own, campusRows, sumCampuses(campusRows)));
        }
        return out;
    }

    // ------------------------------------------------------------------ phép tính một điểm trường

    private List<Row> campusRows(List<Map<String, Object>> norms, Context ctx, CampusRef campus, Map<Long, int[]> have,
            Map<Long, Integer> proposed, Map<Long, Adjustment> adjustments, Map<Long, Set<Long>> shared) {
        // Nhóm "chọn trong nhóm": dòng nào được chọn trong mỗi nhóm.
        Map<String, Boolean> groupHasChoice = new HashMap<>();
        for (Map<String, Object> n : norms) {
            Adjustment a = adjustments.get(AdequacyService.longOf(n.get("id")));
            if (a != null && "CHOOSE_IN_GROUP".equals(a.kind()) && n.get("adjust_group") != null) {
                groupHasChoice.put(groupKey(n), true);
            }
        }
        Map<String, Row> rows = new LinkedHashMap<>();
        for (Map<String, Object> n : norms) {
            boolean optional = Boolean.TRUE.equals(n.get("optional"));
            if (optional || n.get("min_quantity") == null) {
                continue;
            }
            Long normId = AdequacyService.longOf(n.get("id"));
            Long catalogId = AdequacyService.longOf(n.get("catalog_id"));
            Requirement tt = ctx.required(n);
            Adjustment adj = adjustments.get(normId);
            String allowed = (String) n.get("adjust_kind");
            Integer adjusted = tt.value();
            Integer outside = null;
            String warning = tt.warning();
            if (adj != null && !"EXPIRED".equals(adj.status())) {
                switch (adj.kind()) {
                    case "REDUCE" -> {
                        Map<String, Object> reduced = new HashMap<>(n);
                        reduced.put("min_quantity", n.get("adjust_quantity"));
                        reduced.put("basis_size", n.get("adjust_basis_size"));
                        reduced.put("norm_basis", n.get("adjust_basis") == null ? n.get("norm_basis")
                                : n.get("adjust_basis"));
                        Requirement r = ctx.required(reduced);
                        if (r.value() != null && (tt.value() == null || r.value() < tt.value())) {
                            adjusted = r.value();
                        }
                    }
                    case "SUBSTITUTE" -> {
                        Long sub = AdequacyService.longOf(n.get("adjust_substitute_catalog_id"));
                        boolean ok = sub != null ? counted(have.get(sub)) > 0 : adj.substituteConfirmed();
                        if (ok) {
                            adjusted = 0;
                        } else {
                            warning = sub != null ? "Chưa có thiết bị thay thế trên sổ" : "Chưa xác nhận đã có thứ thay thế";
                        }
                    }
                    case "SHARED" -> {
                        boolean ok = shared.getOrDefault(normId, Set.of()).stream()
                                .anyMatch(x -> counted(have.get(x)) > 0);
                        if (ok) {
                            adjusted = 0;
                        } else {
                            warning = "Chưa có thiết bị dùng chung trên sổ";
                        }
                    }
                    case "CHOOSE_IN_GROUP" -> {
                        if (Boolean.FALSE.equals(adj.chosen())) {
                            adjusted = 0;
                        }
                    }
                    case "OUTSIDE" -> outside = adj.outsideNeed();
                    default -> {
                    }
                }
            } else if ("CHOOSE_IN_GROUP".equals(allowed) && n.get("adjust_group") != null
                    && groupHasChoice.containsKey(groupKey(n))) {
                // Nhóm đã chọn nhánh khác: dòng không được chọn về 0.
                adjusted = 0;
            }
            int[] h = catalogId == null ? new int[4] : have.getOrDefault(catalogId, new int[4]);
            int current = counted(h);
            Integer shortTt = tt.value() == null ? null : Math.max(0, tt.value() - current);
            Integer shortAdj = adjusted == null ? null : Math.max(0, adjusted - current);
            Integer surplus = adjusted == null ? null : Math.max(0, current - adjusted);
            Row row = new Row(catalogId, (String) n.get("catalog_code"), normId, (String) n.get("code"),
                    (String) n.get("catalog_name"), (String) n.get("subject_name"), (String) n.get("unit_name"),
                    campus.id(), campus.name(), allowed, (String) n.get("adjust_basis_text"), allowedText(n), tt.value(),
                    adjusted,
                    current, h[1], h[2], h[3], shortTt, shortAdj, surplus, outside,
                    catalogId == null ? 0 : proposed.getOrDefault(catalogId, 0), warning, adj);
            String k = catalogId != null ? "c" + catalogId : "n" + normId;
            Row existing = rows.get(k);
            // Một thiết bị nhiều dòng: dòng đòi nhiều nhất thắng — trừ khi trường đã điều chỉnh một dòng của nó thì
            // dòng có điều chỉnh đứng (điều chỉnh làm trên dòng nào thì thấy trên dòng đó).
            boolean adjustedRow = row.adjustment() != null;
            boolean adjustedExisting = existing != null && existing.adjustment() != null;
            if (existing == null || (adjustedRow && !adjustedExisting)
                    || (adjustedRow == adjustedExisting && stronger(row, existing))) {
                rows.put(k, row);
            }
        }
        return new ArrayList<>(rows.values());
    }

    private static final Map<String, String> BASIS = Map.of("PER_CLASS", "lớp", "PER_STUDENT", "HS",
            "PER_TEACHER", "GV", "PER_ROOM", "phòng", "PER_SCHOOL", "trường");

    /** Điều chỉnh Sở cho, nói bằng một câu ngắn: "Giảm 1/2 HS", "Thay bằng …", "Dùng chung với …", "Chọn 1 trong nhóm …". */
    static String allowedText(Map<String, Object> n) {
        String kind = (String) n.get("adjust_kind");
        if (kind == null) {
            return null;
        }
        return switch (kind) {
            case "REDUCE" -> {
                Object q = n.get("adjust_quantity");
                String qty = q == null ? "?" : new BigDecimal(q.toString()).stripTrailingZeros().toPlainString();
                Integer size = (Integer) n.get("adjust_basis_size");
                String basis = BASIS.getOrDefault((String) n.get("adjust_basis"), "");
                String cond = (String) n.get("adjust_condition");
                yield "Giảm còn " + qty + "/" + (size == null || size == 1 ? "" : size + " ") + basis
                        + (cond == null || cond.isBlank() ? "" : " khi " + cond);
            }
            case "SUBSTITUTE" -> n.get("substitute_name") != null ? "Thay bằng thiết bị " + n.get("substitute_name")
                    : "Thay bằng hình thức: " + n.get("adjust_substitute_text");
            case "SHARED" -> "Dùng chung với " + n.get("shared_names");
            case "CHOOSE_IN_GROUP" -> "Chọn " + n.get("adjust_group_pick") + " trong nhóm " + n.get("adjust_group");
            default -> null;
        };
    }

    /** Dòng đòi nhiều hơn thắng (cùng thiết bị nhiều dòng phụ lục — lấy dòng đòi nhiều nhất, như AdequacyService). */
    private static boolean stronger(Row a, Row b) {
        if (b.requiredTt() == null) {
            return a.requiredTt() != null;
        }
        return a.requiredTt() != null && a.requiredTt() > b.requiredTt();
    }

    private static String groupKey(Map<String, Object> n) {
        return n.get("standard_id") + "|" + n.get("subject_id") + "|" + n.get("adjust_group");
    }

    /** Số đang có của một dòng tồn: dùng được + hỏng + mất (chờ ghi giảm không tính). */
    static int counted(int[] h) {
        return h == null ? 0 : h[0] + h[1] + h[2];
    }

    /** Cộng cả trường = cộng từng điểm trường; thiếu / thừa cộng riêng từng điểm (không bù nhau). */
    public static List<Row> sumCampuses(List<Row> campusRows) {
        Map<String, List<Row>> byKey = new LinkedHashMap<>();
        for (Row r : campusRows) {
            byKey.computeIfAbsent(r.catalogId() != null ? "c" + r.catalogId() : "n" + r.normId(),
                    k -> new ArrayList<>()).add(r);
        }
        List<Row> out = new ArrayList<>();
        for (List<Row> list : byKey.values()) {
            Row f = list.get(0);
            Integer reqTt = sumOrNull(list, Row::requiredTt);
            Integer reqAdj = sumOrNull(list, Row::requiredAdjusted);
            Integer shTt = sumOrNull(list, Row::shortageTt);
            Integer shAdj = sumOrNull(list, Row::shortageAdjusted);
            Integer sur = sumOrNull(list, Row::surplus);
            Integer outside = sumOrNull(list, Row::outsideNeed);
            String warning = list.stream().map(Row::warning).filter(Objects::nonNull).findFirst().orElse(null);
            Row adjusted = list.stream().filter(r -> r.adjustment() != null).findFirst().orElse(null);
            out.add(new Row(f.catalogId(), f.catalogCode(), f.normId(), f.normCode(), f.name(), f.subjectName(),
                    f.unitName(), null, null, f.allowedKind(), f.basisText(), f.allowedText(), reqTt, reqAdj,
                    list.stream().mapToInt(Row::current).sum(), list.stream().mapToInt(Row::broken).sum(),
                    list.stream().mapToInt(Row::lost).sum(), list.stream().mapToInt(Row::pendingDisposal).sum(), shTt,
                    shAdj, sur, outside, list.stream().mapToInt(Row::proposed).sum(), warning,
                    adjusted == null ? null : adjusted.adjustment()));
        }
        return out;
    }

    private static Integer sumOrNull(List<Row> rows, Function<Row, Integer> f) {
        Integer sum = null;
        for (Row r : rows) {
            Integer v = f.apply(r);
            if (v != null) {
                sum = (sum == null ? 0 : sum) + v;
            }
        }
        return sum;
    }

    public static Totals totals(List<Row> rows) {
        int counted = 0;
        int metTt = 0;
        int metAdj = 0;
        int shTt = 0;
        int shAdj = 0;
        int adjusted = 0;
        int outside = 0;
        int unhandled = 0;
        for (Row r : rows) {
            counted++;
            if (r.shortageTt() != null && r.shortageTt() == 0) {
                metTt++;
            }
            if (r.shortageAdjusted() != null && r.shortageAdjusted() == 0) {
                metAdj++;
            }
            shTt += r.shortageTt() == null ? 0 : r.shortageTt();
            shAdj += r.shortageAdjusted() == null ? 0 : r.shortageAdjusted();
            if (r.adjustment() != null && !"EXPIRED".equals(r.adjustment().status())) {
                if ("OUTSIDE".equals(r.adjustment().kind())) {
                    outside++;
                } else {
                    adjusted++;
                }
            }
            // Chưa xử lý: còn thiếu (theo điều chỉnh) mà chưa đưa vào đề xuất mua sắm nào — chỉ để biết, không chặn chốt.
            if (r.shortageAdjusted() != null && r.shortageAdjusted() > 0 && r.proposed() == 0) {
                unhandled++;
            }
        }
        return new Totals(counted, metTt, metAdj, AdequacyService.percent(metTt, counted),
                AdequacyService.percent(metAdj, counted), shTt, shAdj, adjusted, outside, unhandled);
    }

    // ------------------------------------------------------------------ dữ liệu nguồn

    /**
     * Thiết bị tại ngày cắt: (trường → (cơ sở → (thiết bị → [dùng được, hỏng, mất, chờ ghi giảm]))). Trạng thái tại
     * ngày cắt = {@code from_value} của lần đổi trạng thái ĐẦU TIÊN sau ngày cắt (nhãn → mã), không có thì trạng thái
     * hiện tại. Không còn phiếu điều chuyển, ghi giảm (285) nên trường tại ngày cắt là trường hiện tại và không thiết
     * bị nào "chờ ghi giảm" theo phiếu. Thiết bị chỉ tính khi đã ghi tăng trước ngày cắt.
     */
    private Map<Long, Map<Long, Map<Long, int[]>>> equipmentAt(String ids, Year year, Timestamp cut) {
        StringBuilder labels = new StringBuilder();
        for (AssetStatus st : AssetStatus.values()) {
            labels.append(labels.isEmpty() ? "" : ", ").append("('").append(EquipmentLifecycle.statusLabel(st)
                    .replace("'", "''")).append("', '").append(st.name()).append("')");
        }
        boolean past = !year.current();
        String sql = """
                WITH base AS (
                  SELECT e.id, e.catalog_id, COALESCE(e.quantity, 1) AS qty, e.room_id, e.status,
                         e.school_id AS school_at,
                         %s AS status_before,
                         %s AS since,
                         FALSE AS on_disposal
                  FROM equipment e
                  WHERE e.school_id IN (%s)),
                st AS (
                  SELECT b.*, COALESCE(lb.code, b.status) AS status_at FROM base b
                  LEFT JOIN (VALUES %s) lb(label, code) ON lb.label = b.status_before)
                SELECT st.school_at, %s AS campus_id, st.catalog_id, st.status_at, st.on_disposal,
                       SUM(st.qty)::int AS n
                FROM st
                WHERE st.school_at IN (%s) AND st.since <= ?
                GROUP BY 1, 2, 3, 4, 5""".formatted(
                past ? """
                        (SELECT h.from_value FROM equipment_history h WHERE h.equipment_id = e.id AND h.field = 'status'
                           AND h.created_at > ? ORDER BY h.created_at, h.id LIMIT 1)""" : "NULL::varchar",
                """
                        LEAST(COALESCE((SELECT min(h.created_at) FROM equipment_history h WHERE h.equipment_id = e.id
                                        AND h.action = 'GHI_TANG'), e.created_at),
                              COALESCE(e.received_date::timestamptz, 'infinity'::timestamptz))""",
                ids,
                labels,
                FacilityCounting.campusOfRoomSql("st.room_id", "st.school_at"),
                ids);
        List<Object> args = new ArrayList<>();
        if (past) {
            args.add(cut);
        }
        args.add(cut);
        Map<Long, Map<Long, Map<Long, int[]>>> out = new HashMap<>();
        jdbc.query(sql, rs -> {
            AssetStatus status;
            try {
                status = AssetStatus.valueOf(rs.getString("status_at"));
            } catch (IllegalArgumentException e) {
                status = AssetStatus.IN_USE;
            }
            if (OFF_BOOKS.contains(status)) {
                return;
            }
            int[] h = out.computeIfAbsent(rs.getLong("school_at"), k -> new HashMap<>())
                    .computeIfAbsent(key(rs.getObject("campus_id")), k -> new HashMap<>())
                    .computeIfAbsent(rs.getLong("catalog_id"), k -> new int[4]);
            int n = rs.getInt("n");
            if (rs.getBoolean("on_disposal") || PENDING_STATUSES.contains(status)) {
                h[3] += n;
            } else if (BROKEN.contains(status)) {
                h[1] += n;
            } else if (LOST.contains(status)) {
                h[2] += n;
            } else {
                h[0] += n;
            }
        }, args.toArray());
        return out;
    }

    /** Dòng danh mục đang hiệu lực trong năm học, theo cấp, kèm điều chỉnh Sở cho. */
    private Map<String, List<Map<String, Object>>> normsFor(Year year) {
        Map<String, List<Map<String, Object>>> byLevel = new HashMap<>();
        for (Map<String, Object> n : jdbc.queryForList("""
                SELECT lv.code AS level_code, n.id, n.code, n.standard_id, n.catalog_id, c.code AS catalog_code,
                       COALESCE(c.name, n.name) AS catalog_name, n.subject_id, sj.name AS subject_name,
                       sj.code AS subject_code, COALESCE(u.name, n.unit_text) AS unit_name, n.norm_basis,
                       n.min_quantity, n.basis_size, n.grade_levels, n.optional, n.adjust_kind, n.adjust_quantity,
                       n.adjust_basis, n.adjust_basis_size, n.adjust_substitute_catalog_id, n.adjust_group,
                       n.adjust_group_pick, n.adjust_basis_text, n.adjust_condition, n.adjust_substitute_text,
                       subc.name AS substitute_name,
                       (SELECT string_agg(sc.name, ', ' ORDER BY sc.name) FROM equipment_norm_adjust_shared sh
                        JOIN equipment_catalogs sc ON sc.id = sh.catalog_id WHERE sh.norm_id = n.id) AS shared_names
                FROM equipment_norms n
                LEFT JOIN equipment_catalogs subc ON subc.id = n.adjust_substitute_catalog_id
                JOIN equipment_standards sd ON sd.id = n.standard_id AND sd.active
                JOIN education_levels lv ON lv.id = sd.education_level_id
                LEFT JOIN equipment_catalogs c ON c.id = n.catalog_id
                LEFT JOIN units u ON u.id = c.unit_id
                LEFT JOIN subjects sj ON sj.id = n.subject_id
                WHERE n.active AND n.effective_from <= ? AND (n.effective_to IS NULL OR n.effective_to > ?)
                ORDER BY sj.sort_order NULLS LAST, n.sort_order, n.id""", year.end(),
                year.current() ? LocalDate.now(VN) : year.start())) {
            byLevel.computeIfAbsent((String) n.get("level_code"), k -> new ArrayList<>()).add(n);
        }
        return byLevel;
    }

    private Map<Long, Set<Long>> sharedCatalogs() {
        Map<Long, Set<Long>> out = new HashMap<>();
        jdbc.query("SELECT norm_id, catalog_id FROM equipment_norm_adjust_shared", rs -> {
            out.computeIfAbsent(rs.getLong(1), k -> new HashSet<>()).add(rs.getLong(2));
        });
        return out;
    }

    /** Khoá cơ sở trong các bảng nhớ: id, hoặc 0 khi không có cơ sở. */
    private static long key(Object campusId) {
        return campusId == null ? 0L : ((Number) campusId).longValue();
    }

}
