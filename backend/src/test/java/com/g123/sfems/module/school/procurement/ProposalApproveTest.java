package com.g123.sfems.module.school.procurement;

import static com.g123.sfems.module.school.procurement.ProcurementFixtures.admin;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.bodyUser;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.schoolUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sheet "approveProposal" — VoucherWorkflow.approve trên đề xuất mua sắm (NC-03, NC-04). */
class ProposalApproveTest extends ProposalWorkflowTestBase {

    void expectTierError() {
        assertThatThrownBy(() -> workflow.approve(proposal, RESOURCE, null))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("tài khoản của bạn không thuộc cấp này");
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.PENDING);
        verify(events, never()).save(any());
    }

    @Test
    @DisplayName("UTCID01 - N: lãnh đạo trường duyệt → chuyển bước Sở, báo lãnh đạo Sở (MSG09)")
    void utcid01() {
        atStep(ApprovalStep.SCHOOL);
        loginAs(schoolUser(1L));
        boolean last = workflow.approve(proposal, RESOURCE, "Đồng ý");
        assertThat(last).isFalse();
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.PENDING);
        assertThat(proposal.getApprovalStep()).isEqualTo(ApprovalStep.MANAGING_BODY);
        verify(events).save(any(VoucherEvent.class));
        assertThat(publishedEvent().getClass().getSimpleName()).isEqualTo("VoucherAwaiting");
    }

    @Test
    @DisplayName("UTCID02 - N: lãnh đạo Sở duyệt → Đã duyệt, báo người lập")
    void utcid02() {
        atStep(ApprovalStep.MANAGING_BODY);
        loginAs(bodyUser(10L));
        boolean last = workflow.approve(proposal, RESOURCE, null);
        assertThat(last).isTrue();
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.APPROVED);
        assertThat(proposal.getApprovalStep()).isNull();
        Object event = publishedEvent();
        assertThat(event.getClass().getSimpleName()).isEqualTo("VoucherApproved");
        assertThat(event).extracting("recipientId").isEqualTo(100L);
    }

    @Test
    @DisplayName("UTCID03 - A: lãnh đạo trường khác duyệt bước trường (MSG10)")
    void utcid03() {
        atStep(ApprovalStep.SCHOOL);
        loginAs(schoolUser(2L));
        expectTierError();
    }

    @Test
    @DisplayName("UTCID04 - A: lãnh đạo Sở khác duyệt bước Sở (MSG10)")
    void utcid04() {
        atStep(ApprovalStep.MANAGING_BODY);
        loginAs(bodyUser(99L));
        expectTierError();
    }

    @Test
    @DisplayName("UTCID05 - A: lãnh đạo trường duyệt bước Sở (MSG10)")
    void utcid05() {
        atStep(ApprovalStep.MANAGING_BODY);
        loginAs(schoolUser(1L));
        expectTierError();
    }

    @Test
    @DisplayName("UTCID06 - A: quản trị viên không thuộc cấp duyệt nào")
    void utcid06() {
        atStep(ApprovalStep.MANAGING_BODY);
        loginAs(admin());
        expectTierError();
    }

    @Test
    @DisplayName("UTCID07 - A: chưa đăng nhập")
    void utcid07() {
        atStep(ApprovalStep.SCHOOL);
        loginAs(null);
        expectTierError();
    }

    @Test
    @DisplayName("UTCID08 - A: đề xuất còn Nháp → không duyệt được")
    void utcid08() {
        proposal.setStatus(VoucherStatus.DRAFT);
        loginAs(schoolUser(1L));
        assertThatThrownBy(() -> workflow.approve(proposal, RESOURCE, null))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("Phiếu đang ở trạng thái \"nháp\", không duyệt được");
    }

    @Test
    @DisplayName("UTCID09 - B: trường không có Sở quản lý → duyệt cấp trường là bước cuối")
    void utcid09() {
        proposal.setSchool(ProcurementFixtures.school(1L, null));
        atStep(ApprovalStep.SCHOOL);
        loginAs(schoolUser(1L));
        assertThat(workflow.approve(proposal, RESOURCE, null)).isTrue();
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.APPROVED);
    }

    @Test
    @DisplayName("UTCID10 - A: đề xuất đã Đã duyệt → không duyệt lại được")
    void utcid10() {
        proposal.setStatus(VoucherStatus.APPROVED);
        loginAs(bodyUser(10L));
        assertThatThrownBy(() -> workflow.approve(proposal, RESOURCE, null))
                .hasMessageContaining("không duyệt được");
    }
}
