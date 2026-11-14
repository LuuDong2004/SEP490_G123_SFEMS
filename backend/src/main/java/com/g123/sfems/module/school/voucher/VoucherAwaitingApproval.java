package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.ApprovalStep;

/** Published when a submitted voucher reaches an approval tier. */
public record VoucherAwaitingApproval(String resource, Long voucherId, String code, Long schoolId,
        Long managingBodyId, ApprovalStep step) {}
