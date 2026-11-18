package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Campus;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

@Component
public class CampusPolicies extends SchoolOwnedPolicies<Campus> {

    @Override
    public String resource() {
        return "campuses";
    }

    @Override
    public Class<Campus> entityClass() {
        return Campus.class;
    }
}
