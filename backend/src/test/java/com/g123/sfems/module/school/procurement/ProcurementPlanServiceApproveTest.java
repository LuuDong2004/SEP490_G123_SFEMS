package com.g123.sfems.module.school.procurement;

import static com.g123.sfems.module.school.procurement.ProcurementFixtures.catalog;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.line;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.proposal;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.school;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.ProcurementPlan.Status;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sheet "approvePlan" — ProcurementPlanService.approve (NC-06: duyệt kế hoạch, đề xuất chuyển Hoàn tất). */
class ProcurementPlanServiceApproveTest extends ProcurementPlanServiceTestBase {

    static final String MESSAGE = "Đưa vào kế hoạch mua sắm \"Kế hoạch mua sắm 2027\" (năm 2027) đã được duyệt";

    ProcurementPlan plan;
    List<PurchaseProposal> inPlan = new ArrayList<>();
    PurchaseProposal p1;
    PurchaseProposal p2;

    @BeforeEach
    void setUp() {
        plan = ProcurementFixtures.plan(1L, 10L, Status.PENDING);
        givenPlan(plan);
        givenUnpriced(1L, List.of());
        p1 = proposal(21L, school(1L, 10L), VoucherStatus.APPROVED, line(211L, catalog(1L, "Máy chiếu"), 5, null));
        p2 = proposal(22L, school(3L, 10L), VoucherStatus.APPROVED, line(221L, catalog(2L, "Bảng"), 2, null));
        when(rowLevel.<List<PurchaseProposal>>asSystem(eq("procurement_plans.approve"), any(Supplier.class))).thenReturn(inPlan);
    }

    void expectError(String message) {
        assertThatThrownBy(() -> service.approve(1L, null))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining(message);
        verify(workflow, never()).complete(any(), anyString(), any());
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("UTCID01 - N: duyệt kế hoạch 2 đề xuất → Đã duyệt, cả 2 đề xuất Hoàn tất (MSG11)")
    void utcid01() {
        inPlan.addAll(List.of(p1, p2));
        ProcurementPlan result = service.approve(1L, "  Đồng ý  ");
        assertThat(result.getStatus()).isEqualTo(Status.APPROVED);
        assertThat(result.getApprovedAt()).isNotNull();
        assertThat(result.getApprovalNote()).isEqualTo("Đồng ý");
        verify(workflow).complete(p1, PurchaseProposalService.RESOURCE, MESSAGE);
        verify(workflow).complete(p2, PurchaseProposalService.RESOURCE, MESSAGE);
        verify(proposals).persist(p1);
        verify(proposals).persist(p2);
    }

    @Test
    @DisplayName("UTCID02 - N: đề xuất không còn Đã duyệt thì bỏ qua, chỉ hoàn tất đề xuất Đã duyệt")
    void utcid02() {
        p2.setStatus(VoucherStatus.COMPLETED);
        inPlan.addAll(List.of(p1, p2));
        service.approve(1L, null);
        verify(workflow).complete(p1, PurchaseProposalService.RESOURCE, MESSAGE);
        verify(workflow, never()).complete(eq(p2), anyString(), any());
    }

    @Test
    @DisplayName("UTCID03 - A: còn dòng chưa có đơn giá (MSG50)")
    void utcid03() {
        inPlan.add(p1);
        givenUnpriced(1L, List.of("MS-2027-021 · Máy chiếu"));
        expectError("Nhập đơn giá cho 1 thiết bị");
        assertThat(plan.getStatus()).isEqualTo(Status.PENDING);
    }

    @Test
    @DisplayName("UTCID04 - A: kế hoạch đang Nháp")
    void utcid04() {
        plan.setStatus(Status.DRAFT);
        expectError("Kế hoạch không ở trạng thái chờ duyệt");
    }

    @Test
    @DisplayName("UTCID05 - A: kế hoạch đã Đã duyệt")
    void utcid05() {
        plan.setStatus(Status.APPROVED);
        expectError("Kế hoạch không ở trạng thái chờ duyệt");
    }

    @Test
    @DisplayName("UTCID06 - A: lãnh đạo Sở khác duyệt (MSG27)")
    void utcid06() {
        loginAs(ProcurementFixtures.bodyUser(99L));
        expectError("Chỉ lãnh đạo của cơ quan lập kế hoạch mới duyệt được kế hoạch này");
    }

    @Test
    @DisplayName("UTCID07 - A: tài khoản trường duyệt (MSG27)")
    void utcid07() {
        loginAs(ProcurementFixtures.schoolUser(1L));
        expectError("Chỉ lãnh đạo của cơ quan lập kế hoạch");
    }

    @Test
    @DisplayName("UTCID08 - B: ý kiến duyệt chỉ có khoảng trắng → lưu null")
    void utcid08() {
        inPlan.add(p1);
        assertThat(service.approve(1L, "   ").getApprovalNote()).isNull();
    }

    @Test
    @DisplayName("UTCID09 - B: kế hoạch không còn đề xuất nào → vẫn duyệt, không hoàn tất gì")
    void utcid09() {
        assertThat(service.approve(1L, null).getStatus()).isEqualTo(Status.APPROVED);
        verify(workflow, never()).complete(any(), anyString(), any());
    }

    @Test
    @DisplayName("UTCID10 - N: quản trị viên duyệt được")
    void utcid10() {
        loginAs(ProcurementFixtures.admin());
        inPlan.add(p1);
        assertThat(service.approve(1L, null).getStatus()).isEqualTo(Status.APPROVED);
    }
}
