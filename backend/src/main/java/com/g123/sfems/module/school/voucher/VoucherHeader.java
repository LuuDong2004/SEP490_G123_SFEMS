package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * Phần chung trong DTO của mọi phiếu. Mỗi DTO gắn nó bằng {@code @JsonUnwrapped}, nên trên đường
 * truyền các trường này nằm phẳng cạnh trường riêng của phiếu — đúng hình {@code VoucherBase} mà
 * màn hình đọc ({@code domains/voucher/types.ts}).
 *
 * <pre>{@code
 * public record EquipmentIntakeResponse(@JsonUnwrapped VoucherHeader header, LocalDate intakeDate, ...) {}
 * }</pre>
 */
public record VoucherHeader(
        Long id,
        String code,
        RefSummary school,
        VoucherStatus status,
        ApprovalStep approvalStep,
        Instant submittedAt,
        Instant completedAt,
        String cancelReason,
        String returnNote,
        String rejectReason,
        String note,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can,
        @JsonProperty("_actions") Set<String> actions) {

    public static VoucherHeader of(SchoolVoucher voucher, Map<String, Boolean> can, Set<String> actions) {
        return new VoucherHeader(voucher.getId(), voucher.getCode(), school(voucher.getSchool()),
                voucher.getStatus(), voucher.getApprovalStep(), voucher.getSubmittedAt(),
                voucher.getCompletedAt(), voucher.getCancelReason(), voucher.getReturnNote(),
                voucher.getRejectReason(), voucher.getNote(),
                voucher.getCreatedAt(), voucher.getUpdatedAt(),
                can, actions);
    }

    public static RefSummary school(School school) {
        return school == null ? null : new RefSummary(school.getId(), school.getCode(), school.getName());
    }
}
