package com.g123.sfems.module.school.student;

import com.g123.sfems.domain.school.student.Student;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

/**
 * Học sinh dưới phạm vi dòng theo trường, như lớp — chính sách chép từ {@code school_classes} ở 304, CHỈ cho vai loại
 * trường. Vai không có chính sách (Sở, quản trị) không thấy dòng nào ({@code NONE}).
 */
@Component
public class StudentPolicies extends SchoolOwnedPolicies<Student> {

    @Override
    public String resource() {
        return "students";
    }

    @Override
    public Class<Student> entityClass() {
        return Student.class;
    }
}
