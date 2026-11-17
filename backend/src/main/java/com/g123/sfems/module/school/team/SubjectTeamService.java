package com.g123.sfems.module.school.team;

import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.domain.school.team.SubjectTeam;
import com.g123.sfems.module.catalog.base.CampusRule;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.staff.StaffService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Tổ bộ môn. Quy tắc riêng:
 *
 * <ul>
 *   <li>tổ trưởng và giáo viên của tổ phải cùng trường với tổ;</li>
 *   <li>một giáo viên thuộc MỘT tổ — đưa vào tổ này là gỡ khỏi tổ cũ (chuyển tổ), không báo lỗi:
 *       người dùng đang nói "người này về tổ này";</li>
 *   <li>tổ trưởng luôn là thành viên của tổ.</li>
 * </ul>
 */
@Service
public class SubjectTeamService
        extends SchoolOwnedService<SubjectTeam, SubjectTeamRequest, SubjectTeamPatchRequest> {

    private final SubjectTeamRepository teams;
    private final StaffService staff;
    private final SubjectService subjects;

    public SubjectTeamService(
            SubjectTeamRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            StaffService staff,
            SubjectService subjects) {
        super(repository, rowLevel, SubjectTeam.class, SubjectTeam::new, "Tổ bộ môn", schools, principals);
        this.teams = repository;
        this.staff = staff;
        this.subjects = subjects;
    }

    private CampusScope campusScope;

    /** Tiêm qua setter — phạm vi cơ sở (271): tổ theo cơ sở của tổ trưởng. */
    @Autowired
    void setCampusScope(CampusScope campusScope) {
        this.campusScope = campusScope;
    }

    @Override
    protected CampusRule<SubjectTeam> campusRule() {
        return campusScope.subjectTeams();
    }

    @Override
    protected void applyCreateOwned(SubjectTeam item, SubjectTeamRequest request) {
        setLeader(item, request.leader());
        if (request.subjects() != null) {
            syncSubjects(item, request.subjects());
        }
        if (request.members() != null) {
            syncMembers(item, request.members());
        }
        keepLeaderInTeam(item);
    }

    @Override
    protected void applyUpdateOwned(SubjectTeam item, SubjectTeamPatchRequest request) {
        if (request.leader() != null) {
            setLeader(item, request.leader());
        }
        if (request.subjects() != null) {
            syncSubjects(item, request.subjects());
        }
        if (request.members() != null) {
            syncMembers(item, request.members());
        }
        keepLeaderInTeam(item);
    }

    private void setLeader(SubjectTeam item, IdRef ref) {
        Staff leader = ref == null || ref.id() == null ? null : staff.get(ref.id());
        requireSameSchool(item, leader, "leader");
        item.setLeader(leader);
    }

    private void keepLeaderInTeam(SubjectTeam item) {
        Staff leader = item.getLeader();
        if (leader != null && item.getMembers().stream().noneMatch(m -> m.getId().equals(leader.getId()))) {
            leaveOtherTeam(item, leader);
            item.getMembers().add(leader);
        }
    }

    private void syncSubjects(SubjectTeam item, List<IdRef> refs) {
        Set<Long> ids = ids(refs);
        item.getSubjects().removeIf(s -> !ids.contains(s.getId()));
        Set<Long> have = item.getSubjects().stream().map(Subject::getId).collect(Collectors.toSet());
        for (Long id : ids) {
            if (!have.contains(id)) {
                item.getSubjects().add(subjects.get(id));
            }
        }
    }

    private void syncMembers(SubjectTeam item, List<IdRef> refs) {
        Set<Long> ids = ids(refs);
        item.getMembers().removeIf(m -> !ids.contains(m.getId()));
        Set<Long> have = item.getMembers().stream().map(Staff::getId).collect(Collectors.toSet());
        for (Long id : ids) {
            if (have.contains(id)) {
                continue;
            }
            Staff member = staff.get(id);
            requireSameSchool(item, member, "members");
            leaveOtherTeam(item, member);
            item.getMembers().add(member);
        }
    }

    /** Người này đang ở tổ khác thì gỡ khỏi tổ đó trước — một giáo viên một tổ. */
    private void leaveOtherTeam(SubjectTeam item, Staff member) {
        teams.findFirstByMembersId(member.getId())
                .filter(other -> !other.getId().equals(item.getId()))
                .ifPresent(other -> {
                    other.getMembers().removeIf(m -> m.getId().equals(member.getId()));
                    if (other.getLeader() != null && other.getLeader().getId().equals(member.getId())) {
                        other.setLeader(null);
                    }
                    // Đẩy lệnh gỡ xuống trước: unique (staff_id) không cho một người ở hai tổ dù chỉ trong một lần flush.
                    teams.flush();
                });
    }

    private static Set<Long> ids(List<IdRef> refs) {
        return refs.stream()
                .filter(Objects::nonNull)
                .map(IdRef::id)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
