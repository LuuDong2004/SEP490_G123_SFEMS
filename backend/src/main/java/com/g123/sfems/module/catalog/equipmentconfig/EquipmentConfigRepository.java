package com.g123.sfems.module.catalog.equipmentconfig;

import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfig;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import java.util.List;
import org.springframework.data.jpa.repository.Query;

public interface EquipmentConfigRepository extends CatalogRepository<EquipmentConfig> {

    /** Mọi bộ mặc định đang hoạt động; số lượng ít nên kiểm trùng phạm vi trong Java. */
    @Query("select c from EquipmentConfig c where c.defaultConfig = true and c.active = true")
    List<EquipmentConfig> findActiveDefaults();
}
