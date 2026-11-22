package com.g123.sfems.module.school.team;

import com.g123.sfems.domain.school.team.SubjectTeam;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/subject_teams} — mã quyền {@code subject_teams:*}. */
@RestController
@RequestMapping("/api/subject_teams")
public class SubjectTeamController
        extends CatalogController<SubjectTeam, SubjectTeamRequest, SubjectTeamPatchRequest> {

    public SubjectTeamController(SubjectTeamService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "subject_teams";
    }

    @Override
    protected Object respond(SubjectTeam item, RowLevelSecurity rowLevel) {
        return SubjectTeamResponse.from(item, rowLevel);
    }
}
