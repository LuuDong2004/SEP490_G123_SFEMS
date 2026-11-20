package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.module.school.procurement.ProposalSubmitGuard;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Đề xuất mua sắm lập từ số thiếu của chuẩn tối thiểu (có dòng căn cứ {@code proposal_standard_traces}) chỉ TRÌNH lên
 * Sở được khi năm học của nó đã chốt (trưởng nhóm 20/11/2026). Lập, sửa nháp lúc nào cũng được.
 */
@Component
public class ProposalYearGuard implements ProposalSubmitGuard {

    private final JdbcTemplate jdbc;

    public ProposalYearGuard(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void beforeSubmit(Long proposalId, Long schoolId) {
        List<String> open = jdbc.queryForList("""
                SELECT DISTINCT y.name FROM proposal_standard_traces t JOIN school_years y ON y.id = t.school_year_id
                WHERE t.proposal_id = ? AND NOT EXISTS (SELECT 1 FROM school_year_closings c WHERE c.school_id = t.school_id
                      AND c.school_year_id = t.school_year_id AND c.status = 'CLOSED')""", String.class, proposalId);
        if (!open.isEmpty()) {
            throw new FieldValidationException("status", open.get(0) + " chưa chốt — chốt năm học rồi mới trình đề xuất này");
        }
    }
}
