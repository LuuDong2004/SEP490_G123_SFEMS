package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.module.school.voucher.VoucherController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.util.Map;
import java.util.Set;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/equipment_intakes} — phiếu nhập thiết bị (PN-01). Năm endpoint CRUD và các bước duyệt
 * ({@code submit|approve|return|reject|cancel|complete}) đều lấy từ {@link VoucherController}.
 */
@RestController
@RequestMapping("/api/equipment_intakes")
public class EquipmentIntakeController
        extends VoucherController<EquipmentIntake, EquipmentIntakeRequest, EquipmentIntakeRequest> {

    public EquipmentIntakeController(EquipmentIntakeService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected Object toResponse(EquipmentIntake voucher, Map<String, Boolean> can, Set<String> actions) {
        return EquipmentIntakeResponse.from(voucher, can, actions);
    }

    @Override
    protected Object toListResponse(EquipmentIntake voucher, Map<String, Boolean> can, Set<String> actions) {
        return EquipmentIntakeResponse.summary(voucher, can, actions);
    }
}
