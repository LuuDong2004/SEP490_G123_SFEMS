package com.g123.sfems.module.school.team;

import com.g123.sfems.domain.school.team.SubjectTeam;
import com.g123.sfems.module.school.base.SchoolOwnedRepository;
import java.util.Optional;

public interface SubjectTeamRepository extends SchoolOwnedRepository<SubjectTeam> {

    /**
     * Tổ đang giữ cán bộ này. Không phạm vi: câu hỏi "người này đang ở tổ nào" phải nhìn được mọi
     * dòng, như mọi câu kiểm trùng — và cán bộ thì đã được đọc qua phạm vi của người gọi trước đó.
     */
    Optional<SubjectTeam> findFirstByMembersId(Long staffId);
}
