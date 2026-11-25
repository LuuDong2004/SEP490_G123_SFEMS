package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.security.rowlevel.DefaultScope;
import com.g123.sfems.shared.security.rowlevel.FieldDescriptor;
import com.g123.sfems.shared.security.rowlevel.RowLevelPolicySet;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Một chính sách trên {@code equipment_intakes} được phép nói gì.
 *
 * <p>{@code status} nằm trong tập trường, và đây là chỗ đáng dừng lại một câu:
 * nó cho viết được "chỉ sửa phiếu còn là nháp" bằng một phạm vi WRITE thay vì
 * bằng code. Nhưng nếu làm thế thì phải NHỚ tách vế {@code WITH CHECK} ra — một
 * điều kiện trên {@code status} áp cho cả trạng thái mới sẽ cấm luôn việc
 * chuyển DRAFT sang COMPLETED, tức là cấm đúng việc mà phiếu sinh ra để làm.
 * Luật "phiếu đã xác nhận không sửa được" vì vậy nằm ở service: nó là bất biến
 * nghiệp vụ, không phải phạm vi dữ liệu của một vai trò.
 *
 * <p>{@code intakeDate} có mặt để viết được phạm vi theo kỳ ("chỉ phiếu năm
 * nay"), thứ hay được hỏi khi khoá sổ.
 */
@Component
public class EquipmentIntakePolicies implements RowLevelPolicySet<EquipmentIntake> {

    @Override
    public String resource() {
        return "equipment_intakes";
    }

    @Override
    public Class<EquipmentIntake> entityClass() {
        return EquipmentIntake.class;
    }

    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.NONE;
    }

    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.reference("school", School.class),
                FieldDescriptor.column("status", VoucherStatus.class, false),
                // Như `VoucherPolicies`: có lời nhắn trả lại = phiếu đã từng được trình (117).
                FieldDescriptor.column("returnNote", String.class, true),
                // Như `VoucherPolicies`: cấp cao nhất phiếu từng lên tới (125).
                FieldDescriptor.column("reachedStep", ApprovalStep.class, true),
                FieldDescriptor.column("intakeDate", LocalDate.class, false),
                FieldDescriptor.column("createdAt", Instant.class, false));
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt", "updatedAt");
    }
}
