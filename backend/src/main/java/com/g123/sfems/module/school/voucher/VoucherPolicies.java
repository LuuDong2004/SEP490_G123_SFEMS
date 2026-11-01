package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.security.rowlevel.DefaultScope;
import com.g123.sfems.shared.security.rowlevel.FieldDescriptor;
import com.g123.sfems.shared.security.rowlevel.RowLevelPolicySet;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Một chính sách trên bảng phiếu được phép nói gì: {@code school} là ranh giới bảo mật, {@code status}
 * và {@code reachedStep} để viết được phạm vi theo trạng thái ("Sở chỉ thấy phiếu đã trình tới Sở").
 *
 * <p>Lớp con chỉ khai tên resource và kiểu entity, như {@code SchoolOwnedPolicies}.
 *
 * <p>{@code NONE}: vai trò không có phạm vi thì không thấy phiếu nào — một phạm vi bị quên hiện ra
 * thành một màn trống ai cũng báo, không phải một lỗ hổng. Phạm vi của 5 vai trò cho ba loại phiếu
 * seed ở changelog 010.
 */
public abstract class VoucherPolicies<V extends SchoolVoucher> implements RowLevelPolicySet<V> {

    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.NONE;
    }

    @Override
    public List<FieldDescriptor> fields() {
        List<FieldDescriptor> fields = new ArrayList<>(List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.reference("school", School.class),
                FieldDescriptor.column("status", VoucherStatus.class, false),
                FieldDescriptor.column("returnNote", String.class, true),
                FieldDescriptor.column("reachedStep", ApprovalStep.class, true),
                FieldDescriptor.column("createdById", Long.class, true),
                FieldDescriptor.column("createdAt", Instant.class, false)));
        fields.addAll(extraFields());
        return fields;
    }

    protected List<FieldDescriptor> extraFields() {
        return List.of();
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt", "updatedAt");
    }
}
