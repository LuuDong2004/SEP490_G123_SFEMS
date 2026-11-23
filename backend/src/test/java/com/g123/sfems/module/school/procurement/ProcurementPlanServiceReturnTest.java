package com.g123.sfems.module.school.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.ProcurementPlan.Status;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sheet "returnPlan" — ProcurementPlanService.returnToDraft (NC-06 2a: trả lại kế hoạch). */
class ProcurementPlanServiceReturnTest extends ProcurementPlanServiceTestBase {

    ProcurementPlan plan;

    @BeforeEach
    void setUp() {
        plan = ProcurementFixtures.plan(1L, 10L, Status.PENDING);
        givenPlan(plan);
    }

    void expectError(String note, String message) {
        assertThatThrownBy(() -> service.returnToDraft(1L, note))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining(message);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("UTCID01 - N: trả lại có lý do → về Nháp, lưu lý do đã trim")
    void utcid01() {
        ProcurementPlan result = service.returnToDraft(1L, "  Giảm số máy chiếu  ");
        assertThat(result.getStatus()).isEqualTo(Status.DRAFT);
        assertThat(result.getApprovalNote()).isEqualTo("Giảm số máy chiếu");
        verify(repository).save(plan);
    }

    @Test
    @DisplayName("UTCID02 - A: không ghi lý do (MSG26)")
    void utcid02() {
        expectError(null, "Ghi lý do trả lại để chuyên viên biết phải sửa gì");
        assertThat(plan.getStatus()).isEqualTo(Status.PENDING);
    }

    @Test
    @DisplayName("UTCID03 - B: lý do chỉ có khoảng trắng (MSG26)")
    void utcid03() {
        expectError("   ", "Ghi lý do trả lại");
    }

    @Test
    @DisplayName("UTCID04 - A: kế hoạch đang Nháp")
    void utcid04() {
        plan.setStatus(Status.DRAFT);
        expectError("Sửa lại", "Kế hoạch không ở trạng thái chờ duyệt");
    }

    @Test
    @DisplayName("UTCID05 - A: kế hoạch đã Đã duyệt")
    void utcid05() {
        plan.setStatus(Status.APPROVED);
        expectError("Sửa lại", "Kế hoạch không ở trạng thái chờ duyệt");
    }

    @Test
    @DisplayName("UTCID06 - A: lãnh đạo Sở khác trả lại (MSG27)")
    void utcid06() {
        loginAs(ProcurementFixtures.bodyUser(99L));
        expectError("Sửa lại", "Chỉ lãnh đạo của cơ quan lập kế hoạch");
    }

    @Test
    @DisplayName("UTCID07 - B: lý do 1 ký tự")
    void utcid07() {
        assertThat(service.returnToDraft(1L, "x").getApprovalNote()).isEqualTo("x");
    }
}
