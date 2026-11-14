package com.g123.sfems.module.school.intake;

import com.g123.sfems.shared.data.RecordAccess;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

/**
 * Tệp đính kèm theo HOÁ ĐƠN của phiếu ghi tăng ({@code resource = equipment_intake_documents}, 254) — tệp hoá đơn của nhà
 * cung cấp gắn vào đúng hoá đơn ấy, hồ sơ các tài sản sinh ra từ hoá đơn đó xem được chúng. Đọc / ghi được hoá đơn là
 * đọc / ghi được phiếu chứa nó; mã quyền là của phiếu.
 */
@Component
public class EquipmentIntakeDocumentAccess implements RecordAccess {

    public static final String RESOURCE = "equipment_intake_documents";

    private final EntityManager entityManager;
    private final EquipmentIntakeService intakes;

    public EquipmentIntakeDocumentAccess(EntityManager entityManager, EquipmentIntakeService intakes) {
        this.entityManager = entityManager;
        this.intakes = intakes;
    }

    @Override
    public String resource() {
        return RESOURCE;
    }

    @Override
    public String permission() {
        return EquipmentIntakeService.RESOURCE;
    }

    @Override
    public void checkReadable(Long id) {
        intakes.checkReadable(intakeOf(id));
    }

    @Override
    public void checkWritable(Long id) {
        intakes.checkWritable(intakeOf(id));
    }

    private Long intakeOf(Long documentId) {
        return entityManager
                .createQuery("select d.intake.id from EquipmentIntakeDocument d where d.id = :id", Long.class)
                .setParameter("id", documentId)
                .getResultList()
                .stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, documentId));
    }
}
