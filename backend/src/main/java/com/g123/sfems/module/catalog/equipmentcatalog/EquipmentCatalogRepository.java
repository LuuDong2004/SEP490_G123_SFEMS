package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EquipmentCatalogRepository extends CatalogRepository<EquipmentCatalog> {

    /** Thiết bị cùng tên trong danh mục của Sở — trường thêm trùng thì phải chọn cái của Sở. */
    Optional<EquipmentCatalog> findFirstByNameIgnoreCaseAndOwnerSchoolIsNull(String name);

    /** Thiết bị ngoài danh mục cùng tên mà trường đã tự thêm. */
    Optional<EquipmentCatalog> findFirstByNameIgnoreCaseAndOwnerSchool_Id(String name, Long schoolId);

    long countByOwnerSchool_Id(Long schoolId);

    @Query(value = """
            WITH RECURSIVE tree(id) AS (
                SELECT id FROM equipment_catalogs WHERE id = :id
                UNION
                SELECT c.id FROM equipment_catalogs c JOIN tree t ON c.parent_id = t.id
            ) SELECT id FROM tree
            """, nativeQuery = true)
    List<Long> subtreeIds(@Param("id") Long id);
}
