package com.g123.sfems.module.school.schoolclass;

import com.g123.sfems.domain.school.schoolclass.SchoolClass;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

/** Lớp học dưới phạm vi dòng theo trường, như phòng — chính sách chép từ {@code rooms} ở 088. */
@Component
public class SchoolClassPolicies extends SchoolOwnedPolicies<SchoolClass> {

    @Override
    public String resource() {
        return "school_classes";
    }

    @Override
    public Class<SchoolClass> entityClass() {
        return SchoolClass.class;
    }
}
