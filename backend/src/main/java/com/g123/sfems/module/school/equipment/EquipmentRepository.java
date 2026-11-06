package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.module.school.base.SchoolOwnedRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EquipmentRepository extends SchoolOwnedRepository<Equipment> {
}
