package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** Đợt kiểm kê không thuộc một trường nên không đi qua phạm vi dòng; service lọc theo cơ quan. */
public interface InventoryCampaignRepository
        extends JpaRepository<InventoryCampaign, Long>, JpaSpecificationExecutor<InventoryCampaign> {
}
