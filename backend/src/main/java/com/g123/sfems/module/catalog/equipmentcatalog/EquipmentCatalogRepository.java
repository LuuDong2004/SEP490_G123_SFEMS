package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EquipmentCatalogRepository extends CatalogRepository<EquipmentCatalog> {
    @Query(value = """
            WITH RECURSIVE tree(id) AS (
                SELECT id FROM equipment_catalogs WHERE id = :id
                UNION
                SELECT c.id FROM equipment_catalogs c JOIN tree t ON c.parent_id = t.id
            ) SELECT id FROM tree
            """, nativeQuery = true)
    List<Long> subtreeIds(@Param("id") Long id);
}
