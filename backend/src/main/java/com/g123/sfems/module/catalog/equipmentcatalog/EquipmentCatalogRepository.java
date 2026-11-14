package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EquipmentCatalogRepository extends CatalogRepository<EquipmentCatalog> {

    /**
     * Thiết bị trùng tên trong danh mục của Sở — trường định thêm "ngoài danh mục" một thứ Sở đã
     * có thì phải chọn cái của Sở. Không phạm vi: danh mục của Sở mọi trường đều đọc được.
     */
    Optional<EquipmentCatalog> findFirstByNameIgnoreCaseAndOwnerSchoolIsNull(String name);

    /** Thiết bị ngoài danh mục trùng tên của chính trường đó — chặn thêm hai lần. */
    Optional<EquipmentCatalog> findFirstByNameIgnoreCaseAndOwnerSchool_Id(String name, Long schoolId);

    /** Số thiết bị ngoài danh mục của một trường — điểm bắt đầu dò mã kế tiếp. */
    long countByOwnerSchool_Id(Long schoolId);

    /**
     * Id của một nhóm và mọi nhóm con cháu của nó. {@code UNION} (không {@code ALL})
     * nên một dữ liệu lỡ có vòng lặp cũng dừng thay vì chạy mãi.
     */
    @Query(value = """
            WITH RECURSIVE tree(id) AS (
                SELECT id FROM equipment_catalogs WHERE id = :id
                UNION
                SELECT c.id FROM equipment_catalogs c JOIN tree t ON c.parent_id = t.id
            )
            SELECT id FROM tree
            """, nativeQuery = true)
    List<Long> subtreeIds(@Param("id") Long id);
}
