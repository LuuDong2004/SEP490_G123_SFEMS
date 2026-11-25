package com.g123.sfems.module.school.schoolclass;

import com.g123.sfems.domain.school.schoolclass.SchoolClass;
import com.g123.sfems.module.school.base.SchoolOwnedRepository;
import java.util.Optional;

public interface SchoolClassRepository extends SchoolOwnedRepository<SchoolClass> {

    /**
     * Lớp cùng trường, cùng năm học đang giữ mã này. Không phạm vi, như mọi câu kiểm trùng mã:
     * câu hỏi "mã này có ai dùng chưa" phải nhìn được mọi dòng.
     */
    Optional<SchoolClass> findFirstBySchoolIdAndSchoolYearIdAndCodeIgnoreCase(
            Long schoolId, Long schoolYearId, String code);
}
