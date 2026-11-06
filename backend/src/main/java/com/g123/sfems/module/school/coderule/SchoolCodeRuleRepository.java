package com.g123.sfems.module.school.coderule;

import com.g123.sfems.domain.school.coderule.SchoolCodeRule;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SchoolCodeRuleRepository extends JpaRepository<SchoolCodeRule, Long> {

    Optional<SchoolCodeRule> findBySchoolIdAndTarget(Long schoolId, String target);
}
