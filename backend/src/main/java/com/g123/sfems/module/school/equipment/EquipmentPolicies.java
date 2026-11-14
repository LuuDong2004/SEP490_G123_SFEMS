package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

@Component
public class EquipmentPolicies extends SchoolOwnedPolicies<Equipment> {

    @Override
    public String resource() {
        return "equipment";
    }

    @Override
    public Class<Equipment> entityClass() {
        return Equipment.class;
    }
}
