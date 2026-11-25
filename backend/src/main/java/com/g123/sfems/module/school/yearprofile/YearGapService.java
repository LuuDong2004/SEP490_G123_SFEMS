package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.procurement.PurchaseProposalApi;
import com.g123.sfems.module.school.procurement.PurchaseProposalService;
import com.g123.sfems.module.school.procurement.YearAdequacyService;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Row;
import com.g123.sfems.module.school.procurement.YearAdequacyService.SchoolYearResult;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Year;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xử lý dòng thiếu (docs/du-lieu-theo-nam-hoc.md §8 bước 5) — không có "giải trình":
 * <ul>
 *   <li><b>Đưa vào đề xuất mua sắm</b> đúng số thiếu (theo điều chỉnh), lúc nào cũng lập được; dòng ngoài thông tư lấy nhu
 *       cầu trường nhập và gắn nhãn riêng. Mỗi dòng lưu căn cứ ({@code proposal_standard_traces}) để kế hoạch truy ngược
 *       (bước 7). Trình lúc nào cũng được; năm học chưa chốt thì căn cứ mang cờ {@code yearClosed = false} để màn hình
 *       gắn nhãn "Năm học chưa chốt" — số thiếu còn đổi được (trưởng nhóm 23/11/2026, bỏ luật chặn của 20/11).</li>
 * </ul>
 */
@Service
public class YearGapService {

    public record ProposalLine(Long normId, Long campusId) {
    }

    public record ProposalRequest(Long schoolYearId,
            @Size(max = 500, message = "Tối đa 500 dòng một đề xuất") List<ProposalLine> lines) {
    }

    public record ProposalResult(Long proposalId, String code, int lines) {
    }

    public record Trace(Long proposalId, String proposalCode, String schoolName, String schoolYearName, Long catalogId,
            String catalogCode, String catalogName, String campusName, String normCode, int quantity, Integer requiredTt,
            Integer requiredAdjusted, Integer current, String adjustKind, String adjustReason, String basisText,
            boolean outsideStandard,
            /** Năm học của dòng đã chốt chưa — chưa chốt thì số thiếu còn đổi được; màn hình gắn nhãn, không chặn trình. */
            boolean yearClosed) {
    }

    private final JdbcTemplate jdbc;
    private final YearAdequacyService adequacy;
    private final YearStandardService standards;
    private final PurchaseProposalService proposals;
    private final RowLevelPrincipalResolver principals;
    private final VisibleSchools visibleSchools;

    public YearGapService(JdbcTemplate jdbc, YearAdequacyService adequacy, YearStandardService standards,
            PurchaseProposalService proposals,
            RowLevelPrincipalResolver principals, VisibleSchools visibleSchools) {
        this.jdbc = jdbc;
        this.adequacy = adequacy;
        this.standards = standards;
        this.proposals = proposals;
        this.principals = principals;
        this.visibleSchools = visibleSchools;
    }

    // ------------------------------------------------------------------ đề xuất mua sắm

    /**
     * Một đề xuất mua sắm NHÁP từ các dòng thiếu đã chọn: số lượng = số thiếu theo điều chỉnh của điểm trường; dòng
     * "Không được phép" có nhu cầu ngoài thông tư thì thêm một dòng riêng gắn nhãn "Ngoài thông tư".
     */
    @Transactional
    public ProposalResult toProposal(ProposalRequest in) {
        Long school = ownSchool();
        if (in == null || in.lines() == null || in.lines().isEmpty()) {
            throw new FieldValidationException("lines", "Chọn thiết bị còn thiếu");
        }
        Year year = adequacy.year(in.schoolYearId());
        SchoolYearResult r = standards.result(school, year);
        record Pick(Row row, int quantity, boolean outside) {
        }
        List<Pick> picks = new ArrayList<>();
        // Không chọn điểm trường (dòng cộng cả trường) = mọi điểm trường đang thiếu thiết bị của dòng đó. Dòng cộng cả
        // trường gộp theo THIẾT BỊ (YearAdequacyService.sumCampuses), nên ở đây cũng khớp theo thiết bị của dòng định mức,
        // không chỉ theo mã dòng định mức. Chọn một điểm trường thì chỉ lấy dòng của điểm đó.
        List<Row> matched = new ArrayList<>();
        for (ProposalLine l : in.lines()) {
            Set<Long> catalogs = new HashSet<>();
            if (l.campusId() == null) {
                r.campusRows().stream().filter(x -> Objects.equals(x.normId(), l.normId()) && x.catalogId() != null)
                        .forEach(x -> catalogs.add(x.catalogId()));
            }
            r.campusRows().stream()
                    .filter(x -> x.catalogId() != null && (l.campusId() == null
                            ? Objects.equals(x.normId(), l.normId()) || catalogs.contains(x.catalogId())
                            : Objects.equals(x.normId(), l.normId()) && Objects.equals(x.campusId(), l.campusId())))
                    .filter(x -> !matched.contains(x))
                    .forEach(matched::add);
        }
        for (Row row : matched) {
            if (row.shortageAdjusted() != null && row.shortageAdjusted() > 0) {
                picks.add(new Pick(row, row.shortageAdjusted(), false));
            }
            if (row.outsideNeed() != null && row.outsideNeed() > 0 && row.adjustment() != null
                    && "OUTSIDE".equals(row.adjustment().kind()) && !"EXPIRED".equals(row.adjustment().status())) {
                picks.add(new Pick(row, row.outsideNeed(), true));
            }
        }
        if (picks.isEmpty()) {
            throw new FieldValidationException("lines", "Các dòng đã chọn không còn thiếu");
        }
        // Một đề xuất không có hai dòng cùng thiết bị (PurchaseProposalService.validate): nhiều điểm trường, hoặc số thiếu
        // theo chuẩn và nhu cầu ngoài thông tư của cùng thiết bị, gộp thành MỘT dòng cộng số lượng. Căn cứ
        // (proposal_standard_traces) vẫn ghi từng phần bên dưới để truy ngược.
        Map<Long, List<Pick>> byCatalog = new LinkedHashMap<>();
        for (Pick p : picks) {
            byCatalog.computeIfAbsent(p.row().catalogId(), k -> new ArrayList<>()).add(p);
        }
        List<PurchaseProposalApi.LineInput> lines = new ArrayList<>();
        for (List<Pick> group : byCatalog.values()) {
            Row first = group.get(0).row();
            int quantity = group.stream().mapToInt(Pick::quantity).sum();
            Set<String> parts = new LinkedHashSet<>();
            for (Pick p : group) {
                parts.add((p.outside() ? "Ngoài thông tư" : "Theo chuẩn tối thiểu")
                        + (p.row().campusName() == null ? "" : " · " + p.row().campusName()));
            }
            String note = String.join("; ", parts);
            lines.add(new PurchaseProposalApi.LineInput(new IdRef(first.catalogId()), PurchaseProposalLine.Kind.NEW,
                    first.name(), null, first.unitName(), quantity, null, 2,
                    note.length() > 255 ? note.substring(0, 255) : note, null));
        }
        PurchaseProposal created = proposals.create(new PurchaseProposalApi.Request(new IdRef(school), LocalDate.now(),
                null, null, "Bổ sung thiết bị còn thiếu theo chuẩn tối thiểu " + year.name().toLowerCase(), null,
                lines, null), new IdRef(school));
        for (Pick p : picks) {
            Row row = p.row();
            jdbc.update("""
                    INSERT INTO proposal_standard_traces (proposal_id, school_id, school_year_id, catalog_id, campus_id,
                        campus_name, norm_id, norm_code, quantity, required_tt, required_adjusted, current_qty, adjust_kind,
                        adjust_reason, basis_text, outside_standard)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", created.getId(), school, year.id(),
                    row.catalogId(), row.campusId(), row.campusName(), row.normId(), row.normCode(), p.quantity(),
                    row.requiredTt(), row.requiredAdjusted(), row.current(),
                    row.adjustment() == null ? null : row.adjustment().kind(),
                    row.adjustment() == null ? null : row.adjustment().reason(), row.basisText(), p.outside());
        }
        return new ProposalResult(created.getId(), created.getCode(), lines.size());
    }

    // ------------------------------------------------------------------ truy ngược (bước 7)

    /** Căn cứ của các dòng một đề xuất ({@code proposalId}) hoặc mọi đề xuất trong một kế hoạch ({@code planId}). */
    @Transactional(readOnly = true)
    public List<Trace> traces(Long proposalId, Long planId) {
        if (proposalId == null && planId == null) {
            throw new FieldValidationException("proposalId", "Chọn đề xuất hoặc kế hoạch");
        }
        String where = proposalId != null ? "p.id = ?" : "p.plan_id = ?";
        return jdbc.query("""
                SELECT t.*, p.code AS proposal_code, s.name AS school_name, y.name AS year_name, c.code AS catalog_code,
                       c.name AS catalog_name,
                       EXISTS (SELECT 1 FROM school_year_closings yc WHERE yc.school_id = t.school_id
                               AND yc.school_year_id = t.school_year_id AND yc.status = 'CLOSED') AS year_closed
                FROM proposal_standard_traces t JOIN purchase_proposals p ON p.id = t.proposal_id
                JOIN schools s ON s.id = t.school_id JOIN school_years y ON y.id = t.school_year_id
                JOIN equipment_catalogs c ON c.id = t.catalog_id
                WHERE %s%sORDER BY s.name, c.code, t.campus_name NULLS FIRST""".formatted(where,
                visibleSchools.sqlFilter("t.school_id")), (rs, i) -> new Trace(rs.getLong("proposal_id"),
                rs.getString("proposal_code"), rs.getString("school_name"), rs.getString("year_name"),
                rs.getLong("catalog_id"), rs.getString("catalog_code"), rs.getString("catalog_name"),
                rs.getString("campus_name"), rs.getString("norm_code"), rs.getInt("quantity"),
                (Integer) rs.getObject("required_tt"), (Integer) rs.getObject("required_adjusted"),
                (Integer) rs.getObject("current_qty"), rs.getString("adjust_kind"), rs.getString("adjust_reason"),
                rs.getString("basis_text"), rs.getBoolean("outside_standard"), rs.getBoolean("year_closed")),
                proposalId != null ? proposalId : planId);
    }

    private Long ownSchool() {
        RowLevelPrincipal p = principals.current().orElseThrow(() -> new AccessDeniedException("Chưa đăng nhập"));
        if (p.schoolId() == null) {
            throw new AccessDeniedException("Chỉ tài khoản của trường");
        }
        return p.schoolId();
    }
}
