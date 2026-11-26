package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.procurement.YearAdequacyService;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Row;
import com.g123.sfems.module.school.procurement.YearAdequacyService.SchoolYearResult;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Totals;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Year;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.util.ArrayList;
import java.util.HashSet;
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
 * (mỗi lần mở màn), năm cũ tính lại theo dữ liệu của năm đó — thiết bị lấy sau đợt kiểm kê của năm
 * ({@link YearAdequacyService}). Không còn bản chốt (trưởng nhóm 25/11/2026).
 */
@Service
@Transactional(readOnly = true)
public class YearStandardService {

    public record CampusOption(Long id, String name) {
    }

    public record YearStandard(Long schoolId, String schoolName, String levelCode, Long schoolYearId,
            String schoolYearName, boolean current, String source, Long campusId,
            List<CampusOption> campuses, int counted, int metTt, int metAdjusted, int percentTt, int percentAdjusted,
            int shortageTt, int shortageAdjusted, int adjusted, int outside, int unhandled, boolean canAdjust,
            List<Row> rows) {
    }

    /** Một trường trong bảng tổng hợp của Sở (lọc có điều chỉnh, có dòng ngoài thông tư, chênh lệch lớn). */
    /** {@code shortItems…}: số LOẠI thiết bị còn thiếu — không cộng số lượng, vì các dòng khác đơn vị (ml, gam, bộ…). */
    public record OverviewRow(Long schoolId, String schoolName, String levelName, String status, int percentTt,
            int percentAdjusted, int adjusted, int outside, int shortItemsTt, int shortItemsAdjusted, boolean hasEquipment) {
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
        boolean canAdjust = CurrentUser.has("school_norm_adjustments:write")
                && Objects.equals(principal().schoolId(), school);
        SchoolYearResult r = adequacy.forSchool(school, year.id());
        return view(r, campus, year.current() ? "LIVE" : "RECOMPUTED", canAdjust);
    }

    /**
     * Tổng hợp các trường trong phạm vi người xem cho một năm học (chỉ tính trường đã có thiết bị trên sổ — trường chưa
     * nhập thì "thiếu" là thiếu dữ liệu).
     */
    public List<OverviewRow> overview(Long yearId) {
        Year year = adequacy.year(yearId);
        List<SchoolYearProfileService.ProgressRow> progress = profiles.progress(year.id());
        Set<Long> withEquipment = new HashSet<>(jdbc.queryForList(
                "SELECT DISTINCT school_id FROM equipment", Long.class));
        Set<Long> live = new HashSet<>();
        for (SchoolYearProfileService.ProgressRow p : progress) {
            if (withEquipment.contains(p.schoolId())) {
                live.add(p.schoolId());
            }
        }
        Map<Long, SchoolYearResult> computed = adequacy.compute(live, year);
        List<OverviewRow> out = new ArrayList<>();
        for (SchoolYearProfileService.ProgressRow p : progress) {
            SchoolYearResult r = computed.get(p.schoolId());
            if (r == null) {
                out.add(new OverviewRow(p.schoolId(), p.schoolName(), p.levelName(), p.status(), 0, 0, 0, 0, 0, 0, false));
                continue;
            }
            Totals t = YearAdequacyService.totals(r.totalRows());
            out.add(new OverviewRow(p.schoolId(), p.schoolName(), p.levelName(), p.status(), t.percentTt(),
                    t.percentAdjusted(), t.adjusted(), t.outside(), t.counted() - t.metTt(), t.counted() - t.metAdjusted(), true));
        }
        return out;
    }

    /** Kết quả của nhiều trường một năm (không kiểm phạm vi — nơi gọi đã lọc). */
    public Map<Long, SchoolYearResult> results(Set<Long> schools, Year year) {
        return adequacy.compute(schools, year);
    }

    /** Kết quả (cả các điểm trường) của một trường một năm. */
    public SchoolYearResult result(Long school, Year year) {
        return adequacy.forSchool(school, year.id());
    }

    static YearStandard view(SchoolYearResult r, Long campus, String source, boolean canAdjust) {
        Long picked = campus != null && r.campuses().stream().anyMatch(c -> campus.equals(c.id())) ? campus : null;
        // Trường một điểm: "cả trường" chính là điểm đó.
        if (picked == null && r.campuses().size() == 1) {
            picked = r.campuses().get(0).id();
        }
        List<Row> rows = picked == null && r.campuses().size() > 1 ? r.totalRows() : r.rowsOf(picked);
        Totals t = YearAdequacyService.totals(rows);
        return new YearStandard(r.schoolId(), r.schoolName(), r.levelCode(), r.year().id(), r.year().name(),
                r.year().current(), source, picked,
                r.campuses().stream().map(c -> new CampusOption(c.id(), c.name())).toList(), t.counted(), t.metTt(),
                t.metAdjusted(), t.percentTt(), t.percentAdjusted(), t.shortageTt(), t.shortageAdjusted(),
                t.adjusted(), t.outside(), t.unhandled(), canAdjust && picked != null, rows);
    }

    private RowLevelPrincipal principal() {
        return principals.current().orElseThrow(() -> new AccessDeniedException("Chưa đăng nhập"));
    }
}
