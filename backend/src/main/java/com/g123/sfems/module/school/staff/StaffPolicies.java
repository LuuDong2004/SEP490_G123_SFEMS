package com.g123.sfems.module.school.staff;

import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

@Component
public class StaffPolicies extends SchoolOwnedPolicies<Staff> {

    @Override
    public String resource() {
        return "staff";
    }

    @Override
    public Class<Staff> entityClass() {
        return Staff.class;
    }
}
