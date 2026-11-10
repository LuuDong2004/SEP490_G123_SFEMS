package com.g123.sfems.module.school.intake;

import com.g123.sfems.shared.data.RecordAccess;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

/**
 * Tệp đính kèm theo TỪNG DÒNG phiếu nhập ({@code resource = equipment_intake_lines}) — hoá đơn của nhà cung
 * cấp nào gắn vào đúng dòng hàng của nhà cung cấp ấy, và hồ sơ các tài sản sinh ra từ dòng đó xem được chúng.
 * Dòng không có phạm vi dữ liệu riêng: đọc / ghi được dòng là đọc / ghi được phiếu chứa nó (ghi:
 * theo phạm vi ghi của phiếu), và mã quyền là của phiếu.
 */
@Component
public class EquipmentIntakeLineAccess implements RecordAccess {

    public static final String RESOURCE = "equipment_intake_lines";

    private final EntityManager entityManager;
    private final EquipmentIntakeService intakes;

    public EquipmentIntakeLineAccess(EntityManager entityManager, EquipmentIntakeService intakes) {
        this.entityManager = entityManager;
        this.intakes = intakes;
    }

    @Override
    public String resource() {
        return RESOURCE;
    }

    @Override
    public String permission() {
        return intakes.resource();
    }

    @Override
    public void checkReadable(Long id) {
        intakes.checkReadable(intakeOf(id));
    }

    @Override
    public void checkWritable(Long id) {
        intakes.checkWritable(intakeOf(id));
    }

    private Long intakeOf(Long lineId) {
        return entityManager
                .createQuery("select l.intake.id from EquipmentIntakeLine l where l.id = :id", Long.class)
                .setParameter("id", lineId)
                .getResultList()
                .stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, lineId));
    }
}
