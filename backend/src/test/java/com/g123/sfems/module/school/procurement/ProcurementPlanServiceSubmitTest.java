package com.g123.sfems.module.school.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.ProcurementPlan.Status;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sheet "submitPlan" — ProcurementPlanService.submit (NC-05 bước 7–8: trình kế hoạch). */
class ProcurementPlanServiceSubmitTest extends ProcurementPlanServiceTestBase {

    ProcurementPlan plan;

    @BeforeEach
    void setUp() {
        plan = ProcurementFixtures.plan(1L, 10L, Status.DRAFT);
        plan.setApprovalNote("Lý do trả lại lần trước");
        givenPlan(plan);
    }

    void expectError(String message) {
        assertThatThrownBy(() -> service.submit(1L))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining(message);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("UTCID01 - N: kế hoạch hợp lệ → Chờ duyệt, xoá ý kiến trả lại cũ (MSG49)")
    void utcid01() {
        givenProposalCount(1L, 2);
        givenPlannedSum(1L, 5);
        givenUnpriced(1L, List.of());
        ProcurementPlan result = service.submit(1L);
        assertThat(result.getStatus()).isEqualTo(Status.PENDING);
        assertThat(result.getApprovalNote()).isNull();
        verify(repository).save(plan);
    }

    @Test
    @DisplayName("UTCID02 - A: kế hoạch chưa có đề xuất (MSG25)")
    void utcid02() {
        givenProposalCount(1L, 0);
        expectError("Kế hoạch chưa có đề xuất nào");
        assertThat(plan.getStatus()).isEqualTo(Status.DRAFT);
    }

    @Test
    @DisplayName("UTCID03 - A: mọi dòng đều bằng 0 (MSG50)")
    void utcid03() {
        givenProposalCount(1L, 1);
        givenPlannedSum(1L, 0);
        expectError("Mọi dòng đều đang để 0");
    }

    @Test
    @DisplayName("UTCID04 - A: còn dòng chưa có đơn giá (MSG50)")
    void utcid04() {
        givenProposalCount(1L, 1);
        givenPlannedSum(1L, 5);
        givenUnpriced(1L, List.of("MS-2027-001 · Máy chiếu"));
        expectError("Nhập đơn giá cho 1 thiết bị trước khi trình / duyệt kế hoạch (MS-2027-001 · Máy chiếu)");
    }

    @Test
    @DisplayName("UTCID05 - B: tổng số đưa vào kế hoạch = 1")
    void utcid05() {
        givenProposalCount(1L, 1);
        givenPlannedSum(1L, 1);
        givenUnpriced(1L, List.of());
        assertThat(service.submit(1L).getStatus()).isEqualTo(Status.PENDING);
    }

    @Test
    @DisplayName("UTCID06 - A: chuyên viên Sở khác trình")
    void utcid06() {
        loginAs(ProcurementFixtures.bodyUser(99L));
        expectError("Chỉ cơ quan lập kế hoạch mới sửa được kế hoạch này");
    }

    @Test
    @DisplayName("UTCID07 - A: kế hoạch đã Chờ duyệt")
    void utcid07() {
        plan.setStatus(Status.PENDING);
        expectError("Chỉ sửa được kế hoạch nháp");
    }

    @Test
    @DisplayName("UTCID08 - B: 4 dòng chưa có giá → chỉ liệt kê 3 dòng đầu kèm dấu …")
    void utcid08() {
        givenProposalCount(1L, 1);
        givenPlannedSum(1L, 9);
        givenUnpriced(1L, List.of("MS-1 · A", "MS-1 · B", "MS-1 · C", "MS-1 · D"));
        expectError("Nhập đơn giá cho 4 thiết bị trước khi trình / duyệt kế hoạch (MS-1 · A; MS-1 · B; MS-1 · C…)");
    }

    @Test
    @DisplayName("UTCID09 - A: đếm đề xuất trả về null (MSG25)")
    void utcid09() {
        givenProposalCount(1L, null);
        expectError("Kế hoạch chưa có đề xuất nào");
    }
}
