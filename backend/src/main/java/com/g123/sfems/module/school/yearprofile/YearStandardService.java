package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.procurement.YearAdequacyService;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Adjustment;
import com.g123.sfems.module.school.procurement.YearAdequacyService.CampusRef;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Row;
import com.g123.sfems.module.school.procurement.YearAdequacyService.SchoolYearResult;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Totals;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Year;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Màn D — chuẩn tối thiểu theo năm học của một trường (docs/du-lieu-theo-nam-hoc.md §5, §8 bước 4): năm hiện tại tính trực tiếp
 * (mỗi lần mở màn), năm đã chốt đọc bản chốt ({@code school_year_closing_lines}), năm cũ chưa chốt tính lại theo dữ
 * liệu của năm đó.
 */
@Service
@Transactional(readOnly = true)
public class YearStandardService {

    public record CampusOption(Long id, String name) {
    }

    public record YearStandard(Long schoolId, String schoolName, String levelCode, Long schoolYearId,
            String schoolYearName, boolean current, String source, String closedAt, Long campusId,
            List<CampusOption> campuses, int counted, int metTt, int metAdjusted, int percentTt, int percentAdjusted,
            int shortageTt, int shortageAdjusted, int adjusted, int outside, int unhandled, boolean canAdjust,
            List<Row> rows) {
    }

    /** Một trường trong bảng tổng hợp của Sở (lọc có điều chỉnh, có dòng ngoài thông tư, chênh lệch lớn). */
    public record OverviewRow(Long schoolId, String schoolName, String levelName, String status, int percentTt,
            int percentAdjusted, int adjusted, int outside, int shortageTt, int shortageAdjusted, boolean hasEquipment) {
    }

    private final YearAdequacyService adequacy;
    private final RowLevelPrincipalResolver principals;
    private final CampusScope campuses;
    private final JdbcTemplate jdbc;
    private final SchoolYearProfileService profiles;

    public YearStandardService(YearAdequacyService adequacy, RowLevelPrincipalResolver principals,
            CampusScope campuses, JdbcTemplate jdbc, SchoolYearProfileService profiles) {
        this.profiles = profiles;
        this.adequacy = adequacy;
        this.principals = principals;
        this.campuses = campuses;
        this.jdbc = jdbc;
    }

    public YearStandard get(Long schoolId, Long yearId, Long campusId) {
        Long school = schoolId != null ? schoolId : principal().schoolId();
        if (school == null) {
            throw new AccessDeniedException("Chọn trường");
        }
        Long pinned = campuses.pinnedCampusIn(school);
        Long campus = pinned != null ? pinned : campusId;
        Year year = adequacy.year(yearId);
        adequacy.requireVisible(school);
        Map<String, Object> closing = closingOf(school, year.id());
        if (closing != null) {
            SchoolYearResult r = fromClosing(((Number) closing.get("id")).longValue(), school, year);
            return view(r, campus, "CLOSED", (String) closing.get("closed_at"), false);
        }
        boolean canAdjust = CurrentUser.has("school_norm_adjustments:write")
                && Objects.equals(principal().schoolId(), school);
        SchoolYearResult r = adequacy.forSchool(school, year.id());
        return view(r, campus, year.current() ? "LIVE" : "RECOMPUTED", null, canAdjust);
    }

    /**
     * Tổng hợp các trường trong phạm vi người xem cho một năm học: năm đã chốt đọc bản chốt, còn lại tính (chỉ trường đã
     * có thiết bị trên sổ — trường chưa nhập thì "thiếu" là thiếu dữ liệu).
     */
    public List<OverviewRow> overview(Long yearId) {
        Year year = adequacy.year(yearId);
        List<SchoolYearProfileService.ProgressRow> progress = profiles.progress(year.id());
        Set<Long> withEquipment = new HashSet<>(jdbc.queryForList(
                "SELECT DISTINCT school_id FROM equipment", Long.class));
        Map<Long, Long> closings = new HashMap<>();
        jdbc.query("SELECT school_id, id FROM school_year_closings WHERE school_year_id = ? AND status = 'CLOSED'", rs -> {
            closings.put(rs.getLong(1), rs.getLong(2));
        }, year.id());
        Set<Long> live = new HashSet<>();
        for (SchoolYearProfileService.ProgressRow p : progress) {
            if (!closings.containsKey(p.schoolId()) && withEquipment.contains(p.schoolId())) {
                live.add(p.schoolId());
            }
        }
        Map<Long, SchoolYearResult> computed = adequacy.compute(live, year);
        List<OverviewRow> out = new ArrayList<>();
        for (SchoolYearProfileService.ProgressRow p : progress) {
            SchoolYearResult r = closings.containsKey(p.schoolId())
                    ? fromClosing(closings.get(p.schoolId()), p.schoolId(), year) : computed.get(p.schoolId());
            if (r == null) {
                out.add(new OverviewRow(p.schoolId(), p.schoolName(), p.levelName(), p.status(), 0, 0, 0, 0, 0, 0, false));
                continue;
            }
            Totals t = YearAdequacyService.totals(r.totalRows());
            out.add(new OverviewRow(p.schoolId(), p.schoolName(), p.levelName(), p.status(), t.percentTt(),
                    t.percentAdjusted(), t.adjusted(), t.outside(), t.shortageTt(), t.shortageAdjusted(), true));
        }
        return out;
    }

    /** Kết quả (cả các điểm trường) của một trường một năm: bản chốt nếu đã chốt, không thì tính. */
    public SchoolYearResult result(Long school, Year year) {
        Map<String, Object> closing = closingOf(school, year.id());
        return closing != null ? fromClosing(((Number) closing.get("id")).longValue(), school, year)
                : adequacy.forSchool(school, year.id());
    }

    private Map<String, Object> closingOf(Long school, Long year) {
        return jdbc.queryForList("""
                SELECT id, to_char(closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') AS closed_at
                FROM school_year_closings WHERE school_id = ? AND school_year_id = ? AND status = 'CLOSED'""",
                school, year).stream().findFirst().orElse(null);
    }

    /** Năm đã chốt: dòng của bản chốt, không tính lại. */
    SchoolYearResult fromClosing(Long closingId, Long school, Year year) {
        Map<String, Object> s = jdbc.queryForMap("""
                SELECT s.code, s.name, lv.code AS level_code, lv.name AS level_name FROM schools s
                JOIN education_levels lv ON lv.id = s.education_level_id WHERE s.id = ?""", school);
        Map<String, CampusRef> found = new LinkedHashMap<>();
        List<Row> rows = jdbc.query("""
                SELECT l.*, c.is_primary FROM school_year_closing_lines l LEFT JOIN campuses c ON c.id = l.campus_id
                WHERE l.closing_id = ? ORDER BY c.is_primary DESC NULLS LAST, l.campus_name, l.id""", (rs, i) -> {
            Long campusId = (Long) rs.getObject("campus_id");
            found.putIfAbsent(String.valueOf(campusId), new CampusRef(campusId, rs.getString("campus_name"),
                    rs.getBoolean("is_primary")));
            String kind = rs.getString("adjust_kind");
            Adjustment adj = kind == null ? null : new Adjustment(null, kind, rs.getString("adjust_status"),
                    rs.getString("adjust_reason"), null, (Integer) rs.getObject("outside_need"), false, null, null,
                    null);
            return new Row((Long) rs.getObject("catalog_id"), rs.getString("catalog_code"),
                    (Long) rs.getObject("norm_id"), rs.getString("norm_code"), rs.getString("name"),
                    rs.getString("subject_name"), rs.getString("unit_name"), campusId, rs.getString("campus_name"),
                    rs.getString("allowed_kind"), rs.getString("basis_text"), null, (Integer) rs.getObject("required_tt"),
                    (Integer) rs.getObject("required_adjusted"), rs.getInt("current_qty"), rs.getInt("broken"),
                    rs.getInt("lost"), rs.getInt("pending_disposal"), (Integer) rs.getObject("shortage_tt"),
                    (Integer) rs.getObject("shortage_adjusted"), (Integer) rs.getObject("surplus"),
                    (Integer) rs.getObject("outside_need"), rs.getInt("proposed"), rs.getString("warning"), adj);
        }, closingId);
        List<CampusRef> list = new ArrayList<>(found.values());
        if (list.isEmpty()) {
            list.add(new CampusRef(null, "Trường chính", true));
        }
        return new SchoolYearResult(school, (String) s.get("code"), (String) s.get("name"),
                (String) s.get("level_code"), (String) s.get("level_name"), true, year, list, rows,
                YearAdequacyService.sumCampuses(rows));
    }

    static YearStandard view(SchoolYearResult r, Long campus, String source, String closedAt, boolean canAdjust) {
        Long picked = campus != null && r.campuses().stream().anyMatch(c -> campus.equals(c.id())) ? campus : null;
        // Trường một điểm: "cả trường" chính là điểm đó.
        if (picked == null && r.campuses().size() == 1) {
            picked = r.campuses().get(0).id();
        }
        List<Row> rows = picked == null && r.campuses().size() > 1 ? r.totalRows() : r.rowsOf(picked);
        Totals t = YearAdequacyService.totals(rows);
        return new YearStandard(r.schoolId(), r.schoolName(), r.levelCode(), r.year().id(), r.year().name(),
                r.year().current(), source, closedAt, picked,
                r.campuses().stream().map(c -> new CampusOption(c.id(), c.name())).toList(), t.counted(), t.metTt(),
                t.metAdjusted(), t.percentTt(), t.percentAdjusted(), t.shortageTt(), t.shortageAdjusted(),
                t.adjusted(), t.outside(), t.unhandled(), canAdjust && picked != null, rows);
    }

    private RowLevelPrincipal principal() {
        return principals.current().orElseThrow(() -> new AccessDeniedException("Chưa đăng nhập"));
    }
}
