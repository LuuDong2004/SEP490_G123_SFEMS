package com.g123.sfems.module.school.voucher;

import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

/**
 * Gói các bean mà MỌI {@link VoucherService} cần, để lớp con chỉ tiêm một tham số thay vì năm — thêm
 * một phụ thuộc chung sau này không phải sửa constructor của từng loại phiếu.
 */
@Component
public record VoucherServiceDeps(
        RowLevelSecurity rowLevel,
        VoucherWorkflow workflow,
        SchoolService schools,
        RowLevelPrincipalResolver principals,
        EntityManager entityManager) {
}
