package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.module.school.voucher.VoucherPolicies;
import org.springframework.stereotype.Component;

@Component
public class PurchaseProposalPolicies extends VoucherPolicies<PurchaseProposal> {

    @Override
    public String resource() {
        return PurchaseProposalService.RESOURCE;
    }

    @Override
    public Class<PurchaseProposal> entityClass() {
        return PurchaseProposal.class;
    }
}
