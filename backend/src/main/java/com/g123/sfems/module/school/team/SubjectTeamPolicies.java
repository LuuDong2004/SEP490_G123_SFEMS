package com.g123.sfems.module.school.team;

import com.g123.sfems.domain.school.team.SubjectTeam;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

/** Tổ bộ môn dưới phạm vi dòng theo trường, như phòng — chính sách chép từ {@code rooms} ở 102. */
@Component
public class SubjectTeamPolicies extends SchoolOwnedPolicies<SubjectTeam> {

    @Override
    public String resource() {
        return "subject_teams";
    }

    @Override
    public Class<SubjectTeam> entityClass() {
        return SubjectTeam.class;
    }
}
