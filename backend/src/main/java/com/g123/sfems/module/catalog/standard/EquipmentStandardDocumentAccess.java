package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.shared.data.RecordAccess;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

/**
 * Tệp đính kèm của một VĂN BẢN CĂN CỨ của bộ tiêu chuẩn ({@code resource = equipment_standard_documents}) — bản
 * thông tư, văn bản hợp nhất dạng PDF để mở ngay trên màn danh mục tối thiểu (DM-03). Văn bản là dòng con của bộ
 * tiêu chuẩn và không có phạm vi dữ liệu riêng: mã quyền là của bộ ({@code equipment_standards:read} để xem,
 * {@code :write} để thêm / xoá tệp — chỉ Sở và quản trị).
 */
@Component
public class EquipmentStandardDocumentAccess implements RecordAccess {

    public static final String RESOURCE = "equipment_standard_documents";

    private final EntityManager entityManager;

    public EquipmentStandardDocumentAccess(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public String resource() {
        return RESOURCE;
    }

    @Override
    public String permission() {
        return "equipment_standards";
    }

    @Override
    public void checkReadable(Long id) {
        requireExists(id);
    }

    @Override
    public void checkWritable(Long id) {
        requireExists(id);
    }

    private void requireExists(Long id) {
        boolean found = !entityManager
                .createQuery("select d.id from EquipmentStandardDocument d where d.id = :id", Long.class)
                .setParameter("id", id)
                .getResultList()
                .isEmpty();
        if (!found) {
            throw new ResourceNotFoundException(RESOURCE, id);
        }
    }
}
