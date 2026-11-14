package com.g123.sfems.module.school.voucher;

import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

/**
 * Những gì service phiếu nào cũng cần, gói lại một chỗ — để constructor của mỗi
 * loại phiếu chỉ liệt kê cái RIÊNG của nó.
 */
@Component
public record VoucherServiceDeps(
        RowLevelSecurity rowLevel,
        VoucherWorkflow workflow,
        SchoolService schools,
        RowLevelPrincipalResolver principals,
        EntityManager entityManager,
        VoucherForms forms,
        VoucherHolds holds) {
}
