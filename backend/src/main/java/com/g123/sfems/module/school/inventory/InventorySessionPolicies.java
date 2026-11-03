package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.module.school.voucher.VoucherPolicies;
import org.springframework.stereotype.Component;

/** Phạm vi dòng của phiếu kiểm kê: seed ở changelog 010. */
@Component
public class InventorySessionPolicies extends VoucherPolicies<InventorySession> {

    @Override
    public String resource() {
        return "inventory_sessions";
    }

    @Override
    public Class<InventorySession> entityClass() {
        return InventorySession.class;
    }
}
