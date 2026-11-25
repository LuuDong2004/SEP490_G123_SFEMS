package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.module.school.procurement.YearAdequacyService;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Adjustment;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import java.sql.Date;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Điều chỉnh chuẩn tối thiểu của trường (279, docs/du-lieu-theo-nam-hoc.md §8 bước 3) — theo điểm trường × năm học, có lý do,
 * lưu vết, có hiệu lực ngay (không qua Sở duyệt; họ xem và lọc được). Kiểu phải đúng điều chỉnh Sở cho trên dòng
 * danh mục (276):
 * <ul>
 *   <li>Giảm → phải có theo mức giảm của Sở;</li>
 *   <li>Thay thế → thiết bị thay thế trong danh mục phải có trên sổ của điểm trường; hình thức khác thì trường xác
 *       nhận đã có; gốc về 0;</li>
 *   <li>Dùng chung → hệ thống kiểm điểm trường có một thiết bị dùng chung; gốc về 0;</li>
 *   <li>Chọn trong nhóm → chọn nhánh (không quá số Sở cho), nhánh không chọn về 0;</li>
 *   <li>Không được phép → chỉ nhập "nhu cầu thực tế ngoài thông tư" + lý do, tách riêng (OUTSIDE).</li>
 * </ul>
 * Chép sang năm mới ở trạng thái chờ xác nhận lại (vẫn tính); dòng danh mục đổi / ngừng thì điều chỉnh hết hiệu lực
 * ({@link #expireForNorm}).
 */
@Service
@Transactional(readOnly = true)
public class SchoolNormAdjustmentService implements YearAdequacyService.AdjustmentSource,
        SchoolYearInitService.AdjustmentCopier {

    /** Dấu của dòng danh mục: đổi bất kỳ ô nào ảnh hưởng tới phép tính hay điều chỉnh cho phép thì dấu đổi. */
    static final String FINGERPRINT = """
            md5(concat_ws('|', n.catalog_id, n.min_quantity, n.norm_basis, n.basis_size, n.grade_levels, n.optional,
                n.effective_to, n.adjust_kind, n.adjust_quantity, n.adjust_basis, n.adjust_basis_size,
                n.adjust_substitute_catalog_id, n.adjust_substitute_text, n.adjust_group, n.adjust_group_pick,
                (SELECT string_agg(sh.catalog_id::text, ',' ORDER BY sh.catalog_id)
                 FROM equipment_norm_adjust_shared sh WHERE sh.norm_id = n.id)))""";

    public record Input(Long schoolYearId, Long campusId, Long normId,
            @Text(value = FieldRule.CODE, label = "Kiểu điều chỉnh", max = 20) String kind, Boolean chosen,
            @Num(value = NumberRule.QUANTITY, label = "Nhu cầu ngoài thông tư") Integer outsideNeed,
            Boolean substituteConfirmed,
            @Text(value = FieldRule.LONG_TEXT, label = "Lý do", max = 1000) String reason) {
    }

    public record Item(Long id, Long schoolId, String schoolName, Long schoolYearId, Long campusId, String campusName,
            Long normId, String normCode, String normName, String subjectName, String kind, String status, Boolean chosen,
            Integer outsideNeed, boolean substituteConfirmed, String reason, String expiredReason, String updatedAt,
            String updatedBy) {
    }

    public record Event(Long id, String action, String kind, String detail, String reason, String actorName,
            String createdAt) {
    }

    private final JdbcTemplate jdbc;
    private final VisibleSchools visibleSchools;
    private final RowLevelPrincipalResolver principals;
    private final SchoolYearLock lock;

    public SchoolNormAdjustmentService(JdbcTemplate jdbc, VisibleSchools visibleSchools,
            RowLevelPrincipalResolver principals, SchoolYearLock lock) {
        this.jdbc = jdbc;
        this.visibleSchools = visibleSchools;
        this.principals = principals;
        this.lock = lock;
    }

    // ------------------------------------------------------------------ nguồn cho phép tính

    @Override
    public Map<Long, Map<Long, Map<Long, Adjustment>>> load(Set<Long> schoolIds, Long yearId) {
        Map<Long, Map<Long, Map<Long, Adjustment>>> out = new HashMap<>();
        if (schoolIds.isEmpty()) {
            return out;
        }
        String ids = schoolIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        // Dòng còn hiệu lực trước, dòng hết hiệu lực chỉ để hiện "chọn lại" khi không có dòng mới.
        jdbc.query("""
                SELECT a.*, to_char(COALESCE(a.updated_at, a.created_at) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') AS at,
                       u.full_name AS by_name
                FROM school_norm_adjustments a LEFT JOIN users u ON u.id = COALESCE(a.updated_by_id, a.created_by_id)
                WHERE a.school_year_id = ? AND a.norm_id IS NOT NULL AND a.school_id IN (%s)
                ORDER BY a.status = 'EXPIRED', COALESCE(a.updated_at, a.created_at) DESC""".formatted(ids), rs -> {
            Object campus = rs.getObject("campus_id");
            long ck = campus == null ? 0L : ((Number) campus).longValue();
            out.computeIfAbsent(rs.getLong("school_id"), k -> new HashMap<>())
                    .computeIfAbsent(ck, k -> new HashMap<>())
                    .putIfAbsent(rs.getLong("norm_id"), new Adjustment(rs.getLong("id"), rs.getString("kind"),
                            rs.getString("status"), rs.getString("reason"), (Boolean) rs.getObject("chosen"),
                            (Integer) rs.getObject("outside_need"), rs.getBoolean("substitute_confirmed"),
                            rs.getString("expired_reason"), rs.getString("at"), rs.getString("by_name")));
        }, yearId);
        return out;
    }

    /** Chép điều chỉnh còn hiệu lực sang năm mới, chờ xác nhận lại; dòng danh mục đã đổi / ngừng / xoá thì bỏ. */
    @Override
    @Transactional
    public int[] copy(Long schoolId, Long fromYearId, Long toYearId) {
        Map<String, Object> target = jdbc.queryForMap("SELECT start_date FROM school_years WHERE id = ?", toYearId);
        List<Map<String, Object>> source = jdbc.queryForList("""
                SELECT a.*, %s AS fp_now, n.effective_to, n.active AS norm_active
                FROM school_norm_adjustments a LEFT JOIN equipment_norms n ON n.id = a.norm_id
                WHERE a.school_id = ? AND a.school_year_id = ? AND a.status <> 'EXPIRED'""".formatted(FINGERPRINT),
                schoolId, fromYearId);
        int copied = 0;
        int skipped = 0;
        for (Map<String, Object> a : source) {
            Object to = a.get("effective_to");
            boolean stopped = to != null && !((Date) to).toLocalDate()
                    .isAfter(((Date) target.get("start_date")).toLocalDate());
            if (a.get("norm_id") == null || !Boolean.TRUE.equals(a.get("norm_active")) || stopped
                    || !Objects.equals(a.get("fp_now"), a.get("norm_fingerprint"))) {
                skipped++;
                continue;
            }
            Integer taken = jdbc.queryForObject("""
                    SELECT count(*)::int FROM school_norm_adjustments WHERE school_year_id = ? AND norm_id = ?
                      AND COALESCE(campus_id, 0) = COALESCE(?::bigint, 0) AND status <> 'EXPIRED'""", Integer.class,
                    toYearId, a.get("norm_id"), a.get("campus_id"));
            if (taken != null && taken > 0) {
                skipped++;
                continue;
            }
            Long id = jdbc.queryForObject("""
                    INSERT INTO school_norm_adjustments (school_id, school_year_id, campus_id, norm_id, norm_code,
                        catalog_id, kind, status, chosen, outside_need, substitute_confirmed, reason, norm_fingerprint,
                        copied_from_id, created_at, created_by_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_RECONFIRM', ?, ?, ?, ?, ?, ?, now(), ?) RETURNING id""",
                    Long.class, schoolId, toYearId, a.get("campus_id"), a.get("norm_id"), a.get("norm_code"),
                    a.get("catalog_id"), a.get("kind"), a.get("chosen"), a.get("outside_need"),
                    a.get("substitute_confirmed"), a.get("reason"), a.get("norm_fingerprint"), a.get("id"),
                    CurrentUser.id().orElse(null));
            event(id, schoolId, toYearId, (Long) a.get("campus_id"), (Long) a.get("norm_id"), (String) a.get("norm_code"),
                    "COPY", (String) a.get("kind"), "Chép từ năm học trước", (String) a.get("reason"));
            copied++;
        }
        return new int[] {copied, skipped};
    }

    // ------------------------------------------------------------------ đọc

    /** Điều chỉnh của các trường trong phạm vi (Sở lọc trường có điều chỉnh, có dòng ngoài thông tư). */
    public List<Item> list(Long schoolId, Long yearId, String kind, String status) {
        StringBuilder where = new StringBuilder(" WHERE a.school_year_id = ?").append(visibleSchools.sqlFilter("a.school_id"));
        List<Object> args = new ArrayList<>(List.of(yearId != null ? yearId : currentYear()));
        if (schoolId != null) {
            where.append(" AND a.school_id = ?");
            args.add(schoolId);
        }
        if (kind != null && !kind.isBlank()) {
            where.append(" AND a.kind = ?");
            args.add(kind.trim().toUpperCase());
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND a.status = ?");
            args.add(status.trim().toUpperCase());
        }
        return jdbc.query("""
                SELECT a.*, s.name AS school_name, c.name AS campus_name, COALESCE(cat.name, n.name) AS norm_name,
                       sj.name AS subject_name,
                       to_char(COALESCE(a.updated_at, a.created_at) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') AS at,
                       u.full_name AS by_name
                FROM school_norm_adjustments a JOIN schools s ON s.id = a.school_id
                LEFT JOIN campuses c ON c.id = a.campus_id
                LEFT JOIN equipment_norms n ON n.id = a.norm_id
                LEFT JOIN equipment_catalogs cat ON cat.id = a.catalog_id
                LEFT JOIN subjects sj ON sj.id = n.subject_id
                LEFT JOIN users u ON u.id = COALESCE(a.updated_by_id, a.created_by_id)""" + where
                + " ORDER BY s.name, c.name NULLS FIRST, a.norm_code", (rs, i) -> new Item(rs.getLong("id"),
                rs.getLong("school_id"), rs.getString("school_name"), rs.getLong("school_year_id"),
                (Long) rs.getObject("campus_id"), rs.getString("campus_name"), (Long) rs.getObject("norm_id"),
                rs.getString("norm_code"), rs.getString("norm_name"), rs.getString("subject_name"), rs.getString("kind"),
                rs.getString("status"), (Boolean) rs.getObject("chosen"), (Integer) rs.getObject("outside_need"),
                rs.getBoolean("substitute_confirmed"), rs.getString("reason"), rs.getString("expired_reason"),
                rs.getString("at"), rs.getString("by_name")), args.toArray());
    }

    /** Lưu vết điều chỉnh của một dòng ở một điểm trường (mọi năm học). */
    public List<Event> history(Long schoolId, Long normId, Long campusId) {
        Long school = schoolId != null ? schoolId : ownSchool();
        requireVisible(school);
        return jdbc.query("""
                SELECT e.id, e.action, e.kind, e.detail, e.reason, e.actor_name,
                       to_char(e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI') AS at
                FROM school_norm_adjustment_events e
                WHERE e.school_id = ? AND e.norm_id = ? AND COALESCE(e.campus_id, 0) = COALESCE(?::bigint, 0)
                ORDER BY e.created_at DESC, e.id DESC""", (rs, i) -> new Event(rs.getLong(1), rs.getString(2),
                rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7)), school, normId,
                campusId);
    }

    // ------------------------------------------------------------------ ghi

    @Transactional
    public Item save(Input in) {
        Long school = ownSchool();
        if (in == null || in.normId() == null) {
            throw new FieldValidationException("normId", "Chọn thiết bị");
        }
        Long year = in.schoolYearId() != null ? in.schoolYearId() : currentYear();
        Long campus = campusOf(school, in.campusId());
        Map<String, Object> n = jdbc.queryForList("""
                SELECT n.*, %s AS fp, COALESCE(c.name, n.name) AS label FROM equipment_norms n
                JOIN equipment_standards sd ON sd.id = n.standard_id AND sd.active
                JOIN education_levels lv ON lv.id = sd.education_level_id
                JOIN schools s ON s.education_level_id = lv.id AND s.id = ?
                LEFT JOIN equipment_catalogs c ON c.id = n.catalog_id
                WHERE n.id = ? AND n.active
                  AND (n.effective_to IS NULL OR n.effective_to > (SELECT GREATEST(y.start_date, CASE WHEN y.is_current
                       THEN CURRENT_DATE ELSE y.start_date END) FROM school_years y WHERE y.id = ?))""".formatted(FINGERPRINT),
                school, in.normId(), year).stream().findFirst()
                .orElseThrow(() -> new FieldValidationException("normId",
                        "Thiết bị không thuộc danh mục tối thiểu đang áp dụng của năm học"));
        String allowed = (String) n.get("adjust_kind");
        String kind = in.kind() == null ? "" : in.kind().trim().toUpperCase();
        String reason = in.reason() == null ? "" : in.reason().trim();
        if (reason.isEmpty()) {
            throw new FieldValidationException("reason", "Vui lòng nhập lý do");
        }
        Boolean chosen = null;
        Integer outside = null;
        boolean confirmed = false;
        if ("NONE".equals(allowed)) {
            if (!"OUTSIDE".equals(kind)) {
                throw new FieldValidationException("kind", "Dòng không được phép điều chỉnh — chỉ nhập nhu cầu ngoài thông tư");
            }
            if (in.outsideNeed() == null || in.outsideNeed() < 1) {
                throw new FieldValidationException("outsideNeed", "Vui lòng nhập nhu cầu thực tế");
            }
            outside = in.outsideNeed();
        } else {
            if (!allowed.equals(kind)) {
                throw new FieldValidationException("kind", "Sở chỉ cho điều chỉnh kiểu khác trên dòng này");
            }
            switch (kind) {
                case "SUBSTITUTE" -> {
                    Long sub = n.get("adjust_substitute_catalog_id") == null ? null
                            : ((Number) n.get("adjust_substitute_catalog_id")).longValue();
                    if (sub != null) {
                        if (onBooks(school, campus, List.of(sub)) == 0) {
                            throw new FieldValidationException("kind", "Điểm trường chưa có thiết bị thay thế trên sổ");
                        }
                    } else if (!Boolean.TRUE.equals(in.substituteConfirmed())) {
                        throw new FieldValidationException("substituteConfirmed", "Xác nhận trường đã có thứ thay thế");
                    }
                    confirmed = true;
                }
                case "SHARED" -> {
                    List<Long> shared = jdbc.queryForList(
                            "SELECT catalog_id FROM equipment_norm_adjust_shared WHERE norm_id = ?", Long.class, in.normId());
                    if (shared.isEmpty() || onBooks(school, campus, shared) == 0) {
                        throw new FieldValidationException("kind", "Điểm trường chưa có thiết bị dùng chung trên sổ");
                    }
                }
                case "CHOOSE_IN_GROUP" -> {
                    chosen = true;
                    Integer pick = (Integer) n.get("adjust_group_pick");
                    Integer already = jdbc.queryForObject("""
                            SELECT count(*)::int FROM school_norm_adjustments a JOIN equipment_norms m ON m.id = a.norm_id
                            WHERE a.school_year_id = ? AND COALESCE(a.campus_id, 0) = COALESCE(?::bigint, 0)
                              AND a.status <> 'EXPIRED' AND a.kind = 'CHOOSE_IN_GROUP' AND a.chosen AND a.norm_id <> ?
                              AND m.standard_id = ? AND m.subject_id IS NOT DISTINCT FROM ? AND m.adjust_group = ?""",
                            Integer.class, year, campus, in.normId(), n.get("standard_id"), n.get("subject_id"),
                            n.get("adjust_group"));
                    if (pick != null && already != null && already >= pick) {
                        throw new FieldValidationException("chosen", "Nhóm chỉ chọn " + pick + " thiết bị — bỏ một nhánh đã chọn trước");
                    }
                }
                case "REDUCE" -> {
                }
                default -> throw new FieldValidationException("kind", "Chọn kiểu điều chỉnh");
            }
        }
        Long existing = jdbc.queryForList("""
                SELECT id FROM school_norm_adjustments WHERE school_year_id = ? AND norm_id = ?
                  AND COALESCE(campus_id, 0) = COALESCE(?::bigint, 0) AND status <> 'EXPIRED'""", Long.class, year,
                in.normId(), campus).stream().findFirst().orElse(null);
        Long user = CurrentUser.id().orElse(null);
        Long id;
        if (existing != null) {
            jdbc.update("""
                    UPDATE school_norm_adjustments SET kind = ?, status = 'ACTIVE', chosen = ?, outside_need = ?,
                        substitute_confirmed = ?, reason = ?, norm_fingerprint = ?, updated_at = now(), updated_by_id = ?
                    WHERE id = ?""", kind, chosen, outside, confirmed, reason, n.get("fp"), user, existing);
            id = existing;
        } else {
            id = jdbc.queryForObject("""
                    INSERT INTO school_norm_adjustments (school_id, school_year_id, campus_id, norm_id, norm_code,
                        catalog_id, kind, status, chosen, outside_need, substitute_confirmed, reason, norm_fingerprint,
                        created_at, created_by_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, now(), ?) RETURNING id""", Long.class, school,
                    year, campus, in.normId(), n.get("code"), n.get("catalog_id"), kind, chosen, outside, confirmed,
                    reason, n.get("fp"), user);
        }
        event(id, school, year, campus, in.normId(), (String) n.get("code"), "SAVE", kind,
                outside != null ? "Nhu cầu ngoài thông tư: " + outside : null, reason);
        lock.touched(school, year, campus);
        return item(id);
    }

    /** Xác nhận lại điều chỉnh chép từ năm trước (giữ nguyên nội dung). */
    @Transactional
    public Item reconfirm(Long id) {
        Map<String, Object> a = writable(id);
        jdbc.update("UPDATE school_norm_adjustments SET status = 'ACTIVE', updated_at = now(), updated_by_id = ?"
                + " WHERE id = ? AND status = 'PENDING_RECONFIRM'", CurrentUser.id().orElse(null), id);
        event(id, (Long) a.get("school_id"), (Long) a.get("school_year_id"), (Long) a.get("campus_id"),
                (Long) a.get("norm_id"), (String) a.get("norm_code"), "RECONFIRM", (String) a.get("kind"), null,
                (String) a.get("reason"));
        lock.touched((Long) a.get("school_id"), (Long) a.get("school_year_id"), (Long) a.get("campus_id"));
        return item(id);
    }

    /** Bỏ điều chỉnh — dòng tính lại theo thông tư. */
    @Transactional
    public Map<String, Object> remove(Long id) {
        Map<String, Object> a = writable(id);
        event(null, (Long) a.get("school_id"), (Long) a.get("school_year_id"), (Long) a.get("campus_id"),
                (Long) a.get("norm_id"), (String) a.get("norm_code"), "REMOVE", (String) a.get("kind"), null, null);
        jdbc.update("DELETE FROM school_norm_adjustments WHERE id = ?", id);
        lock.touched((Long) a.get("school_id"), (Long) a.get("school_year_id"), (Long) a.get("campus_id"));
        return Map.of("id", id);
    }

    /**
     * Dòng danh mục đổi / ngừng / xoá (bước 9): điều chỉnh còn hiệu lực trên dòng đó hết hiệu lực khi dấu
     * của dòng khác dấu lúc lưu (hoặc dòng bị xoá / ngừng). Trả về các trường bị ảnh hưởng để nhắc chọn lại.
     */
    @Transactional
    public List<Long> expireForNorm(Long normId, String why, boolean always) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT a.id, a.school_id, a.school_year_id, a.campus_id, a.norm_code, a.kind, a.norm_fingerprint,
                       (SELECT %s FROM equipment_norms n WHERE n.id = a.norm_id) AS fp_now
                FROM school_norm_adjustments a JOIN school_years y ON y.id = a.school_year_id
                LEFT JOIN equipment_norms en ON en.id = a.norm_id
                WHERE a.norm_id = ? AND a.status <> 'EXPIRED'
                  -- Ngừng từ một năm học: năm học kết thúc trước ngày thôi áp dụng vẫn giữ điều chỉnh.
                  AND NOT (en.effective_to IS NOT NULL AND y.end_date < en.effective_to)""".formatted(
                FINGERPRINT), normId);
        List<Long> schools = new ArrayList<>();
        for (Map<String, Object> a : rows) {
            if (!always && Objects.equals(a.get("fp_now"), a.get("norm_fingerprint"))) {
                continue;
            }
            Long id = ((Number) a.get("id")).longValue();
            jdbc.update("UPDATE school_norm_adjustments SET status = 'EXPIRED', expired_reason = ?, expired_at = now()"
                    + " WHERE id = ?", why, id);
            event(id, (Long) a.get("school_id"), (Long) a.get("school_year_id"), (Long) a.get("campus_id"), normId,
                    (String) a.get("norm_code"), "EXPIRE", (String) a.get("kind"), why, null);
            if (!schools.contains((Long) a.get("school_id"))) {
                schools.add((Long) a.get("school_id"));
            }
        }
        return schools;
    }

    // ------------------------------------------------------------------ nội bộ

    /** Số thiết bị còn trên sổ (không kể đã ra khỏi sổ) của các thiết bị danh mục ở một điểm trường. */
    int onBooks(Long school, Long campus, List<Long> catalogs) {
        String ids = catalogs.stream().map(String::valueOf).collect(Collectors.joining(","));
        List<Object> args = new ArrayList<>(List.of(school));
        String campusFilter = "";
        if (campus != null) {
            campusFilter = FacilityCounting.roomInCampusSql("e.room_id", "e.school_id", "?");
            args.add(campus);
        }
        Integer n = jdbc.queryForObject("""
                SELECT count(*)::int FROM equipment e WHERE e.school_id = ? AND e.catalog_id IN (%s)
                  AND e.status <> 'LOST'%s""".formatted(
                ids, campusFilter), Integer.class, args.toArray());
        return n == null ? 0 : n;
    }

    private Item item(Long id) {
        return jdbc.query("""
                SELECT a.*, s.name AS school_name, c.name AS campus_name, COALESCE(cat.name, n.name) AS norm_name,
                       sj.name AS subject_name,
                       to_char(COALESCE(a.updated_at, a.created_at) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') AS at,
                       u.full_name AS by_name
                FROM school_norm_adjustments a JOIN schools s ON s.id = a.school_id
                LEFT JOIN campuses c ON c.id = a.campus_id
                LEFT JOIN equipment_norms n ON n.id = a.norm_id
                LEFT JOIN equipment_catalogs cat ON cat.id = a.catalog_id
                LEFT JOIN subjects sj ON sj.id = n.subject_id
                LEFT JOIN users u ON u.id = COALESCE(a.updated_by_id, a.created_by_id)
                WHERE a.id = ?""", (rs, i) -> new Item(rs.getLong("id"), rs.getLong("school_id"),
                rs.getString("school_name"), rs.getLong("school_year_id"), (Long) rs.getObject("campus_id"),
                rs.getString("campus_name"), (Long) rs.getObject("norm_id"), rs.getString("norm_code"),
                rs.getString("norm_name"), rs.getString("subject_name"), rs.getString("kind"), rs.getString("status"),
                (Boolean) rs.getObject("chosen"), (Integer) rs.getObject("outside_need"),
                rs.getBoolean("substitute_confirmed"), rs.getString("reason"), rs.getString("expired_reason"),
                rs.getString("at"), rs.getString("by_name")), id).stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("SchoolNormAdjustment", id));
    }

    private Map<String, Object> writable(Long id) {
        Long school = ownSchool();
        Map<String, Object> a = jdbc.queryForList("SELECT * FROM school_norm_adjustments WHERE id = ? AND school_id = ?",
                id, school).stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("SchoolNormAdjustment", id));
        Long pinned = principals.current().map(RowLevelPrincipal::campusId).orElse(null);
        if (pinned != null && !Objects.equals(pinned, a.get("campus_id"))) {
            throw new FieldValidationException("campusId", "Không thuộc cơ sở của tài khoản");
        }
        return a;
    }

    private void event(Long adjustment, Long school, Long year, Long campus, Long norm, String normCode, String action,
            String kind, String detail, String reason) {
        jdbc.update("""
                INSERT INTO school_norm_adjustment_events (adjustment_id, school_id, school_year_id, campus_id, norm_id,
                    norm_code, action, kind, detail, reason, actor_id, actor_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT full_name FROM users WHERE id = ?), now())""",
                adjustment, school, year, campus, norm, normCode, action, kind, detail, reason,
                CurrentUser.id().orElse(null), CurrentUser.id().orElse(null));
    }

    /** Điểm trường của điều chỉnh: thuộc trường, còn dùng; trường chưa khai cơ sở thì trống. */
    private Long campusOf(Long school, Long campus) {
        Long pinned = principals.current().map(RowLevelPrincipal::campusId).orElse(null);
        Long picked = pinned != null ? pinned : campus;
        List<Long> active = jdbc.queryForList("SELECT id FROM campuses WHERE school_id = ? AND active", Long.class, school);
        if (active.isEmpty()) {
            return null;
        }
        if (picked == null) {
            if (active.size() == 1) {
                return active.get(0);
            }
            throw new FieldValidationException("campusId", "Chọn điểm trường");
        }
        if (!active.contains(picked)) {
            throw new FieldValidationException("campusId", "Điểm trường không thuộc trường hoặc đã ngừng dùng");
        }
        return picked;
    }

    private Long currentYear() {
        return jdbc.queryForList("SELECT id FROM school_years WHERE is_current", Long.class).stream().findFirst()
                .orElseThrow(() -> new FieldValidationException("schoolYearId", "Chưa đặt năm học hiện tại"));
    }

    private void requireVisible(Long school) {
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(school)) {
            throw new ResourceNotFoundException("School", school);
        }
    }

    private Long ownSchool() {
        RowLevelPrincipal p = principals.current().orElseThrow(() -> new AccessDeniedException("Chưa đăng nhập"));
        if (p.schoolId() == null) {
            throw new AccessDeniedException("Chỉ tài khoản của trường áp dụng điều chỉnh");
        }
        return p.schoolId();
    }
}
