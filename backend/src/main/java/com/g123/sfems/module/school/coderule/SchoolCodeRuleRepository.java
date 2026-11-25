package com.g123.sfems.module.school.coderule;

import com.g123.sfems.domain.school.coderule.SchoolCodeRule;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Không qua phạm vi dòng: mọi lối vào đi qua {@link SchoolCodeService}, nơi trường được kiểm bằng
 * {@code SchoolService.get} (đọc ngoài phạm vi là 404) trước khi chạm bảng này.
 */
public interface SchoolCodeRuleRepository extends JpaRepository<SchoolCodeRule, Long> {

    List<SchoolCodeRule> findBySchoolId(Long schoolId);

    Optional<SchoolCodeRule> findBySchoolIdAndTarget(Long schoolId, String target);
}
