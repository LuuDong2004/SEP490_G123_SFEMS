package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Building;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

@Component
public class BuildingPolicies extends SchoolOwnedPolicies<Building> {

    @Override
    public String resource() {
        return "buildings";
    }

    @Override
    public Class<Building> entityClass() {
        return Building.class;
    }
}
