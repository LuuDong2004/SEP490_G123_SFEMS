package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

/** Phạm vi dòng của hồ sơ thiết bị: seed ở changelog 010. */
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
