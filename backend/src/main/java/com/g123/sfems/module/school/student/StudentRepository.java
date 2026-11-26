package com.g123.sfems.module.school.student;

import com.g123.sfems.domain.school.student.Student;
import com.g123.sfems.module.school.base.SchoolOwnedRepository;
import java.util.Optional;

public interface StudentRepository extends SchoolOwnedRepository<Student> {

    /**
     * Học sinh cùng lớp đang giữ mã này. Không phạm vi, như mọi câu kiểm trùng mã: câu hỏi "mã này có ai dùng chưa"
     * phải nhìn được mọi dòng.
     */
    Optional<Student> findFirstBySchoolClassIdAndCodeIgnoreCase(Long classId, String code);
}
