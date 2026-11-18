package com.g123.sfems.module.school.team;

import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.domain.school.team.SubjectTeam;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Hình dạng trên đường truyền của một tổ bộ môn. */
public record SubjectTeamResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary school,
        RefSummary leader,
        List<RefSummary> subjects,
        List<Member> members,
        int memberCount,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /** Một giáo viên của tổ — đủ để hiện tên và môn chính, không kèm cả hồ sơ cán bộ. */
    public record Member(Long id, String code, String name, String mainSubject) {

        static Member from(Staff staff) {
            return new Member(staff.getId(), staff.getCode(), staff.getName(),
                    staff.getMainSubject() == null ? null : staff.getMainSubject().getName());
        }
    }

    public static SubjectTeamResponse from(SubjectTeam item, RowLevelSecurity rowLevel) {
        var school = item.getSchool();
        return new SubjectTeamResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(), item.getActive(), item.getNote(),
                new RefSummary(school.getId(), school.getCode(), school.getName()),
                RefSummary.of(item.getLeader()),
                item.getSubjects().stream().map(RefSummary::of).toList(),
                item.getMembers().stream().map(Member::from).toList(),
                item.getMembers().size(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
