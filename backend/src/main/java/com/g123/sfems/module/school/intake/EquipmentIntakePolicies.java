package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.module.school.voucher.VoucherPolicies;
import org.springframework.stereotype.Component;

/** Phạm vi dòng của phiếu nhập: seed ở changelog 010. */
@Component
public class EquipmentIntakePolicies extends VoucherPolicies<EquipmentIntake> {

    @Override
    public String resource() {
        return "equipment_intakes";
    }

    @Override
    public Class<EquipmentIntake> entityClass() {
        return EquipmentIntake.class;
    }
}
