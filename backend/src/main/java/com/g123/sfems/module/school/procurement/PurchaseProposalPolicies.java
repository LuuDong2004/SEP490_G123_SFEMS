package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.module.school.voucher.VoucherPolicies;
import org.springframework.stereotype.Component;

/** Phạm vi dòng của đề xuất mua sắm: seed ở changelog 010. */
@Component
public class PurchaseProposalPolicies extends VoucherPolicies<PurchaseProposal> {

    @Override
    public String resource() {
        return "purchase_proposals";
    }

    @Override
    public Class<PurchaseProposal> entityClass() {
        return PurchaseProposal.class;
    }
}
