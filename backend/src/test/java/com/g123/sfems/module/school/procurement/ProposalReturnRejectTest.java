package com.g123.sfems.module.school.procurement;

import static com.g123.sfems.module.school.procurement.ProcurementFixtures.bodyUser;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.schoolUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sheet "returnRejectProposal" — VoucherWorkflow.returnToDraft / reject trên đề xuất mua sắm (NC-03 3a, 3b; NC-04 2a). */
class ProposalReturnRejectTest extends ProposalWorkflowTestBase {

    /** Sự kiện VoucherDecided (package-private) — đọc field qua reflection. */
    Object decided() {
        Object event = publishedEvent();
        assertThat(event.getClass().getSimpleName()).isEqualTo("VoucherDecided");
        return event;
    }

    @Test
    @DisplayName("UTCID01 - N: lãnh đạo trường trả lại có lời nhắn → về Nháp, giữ số phiếu")
    void utcid01() {
        atStep(ApprovalStep.SCHOOL);
        loginAs(schoolUser(1L));
        workflow.returnToDraft(proposal, RESOURCE, "  Bổ sung đơn giá  ");
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(proposal.getReturnNote()).isEqualTo("Bổ sung đơn giá");
        assertThat(proposal.getApprovalStep()).isNull();
        assertThat(proposal.getCode()).isEqualTo("MS-2027-001");
        assertThat(decided()).extracting("decision").hasToString("RETURNED");
    }

    @Test
    @DisplayName("UTCID02 - A: trả lại không ghi lời nhắn (GBR-04)")
    void utcid02() {
        atStep(ApprovalStep.SCHOOL);
        loginAs(schoolUser(1L));
        assertThatThrownBy(() -> workflow.returnToDraft(proposal, RESOURCE, null))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("Ghi rõ cần sửa gì trước khi trả lại");
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.PENDING);
    }

    @Test
    @DisplayName("UTCID03 - B: lời nhắn chỉ có khoảng trắng")
    void utcid03() {
        atStep(ApprovalStep.SCHOOL);
        loginAs(schoolUser(1L));
        assertThatThrownBy(() -> workflow.returnToDraft(proposal, RESOURCE, "   "))
                .hasMessageContaining("Ghi rõ cần sửa gì trước khi trả lại");
    }

    @Test
    @DisplayName("UTCID04 - A: trả lại đề xuất đang Nháp")
    void utcid04() {
        proposal.setStatus(VoucherStatus.DRAFT);
        loginAs(schoolUser(1L));
        assertThatThrownBy(() -> workflow.returnToDraft(proposal, RESOURCE, "Sửa"))
                .hasMessageContaining("không trả lại được");
    }

    @Test
    @DisplayName("UTCID05 - N: lãnh đạo Sở trả lại → về Nháp")
    void utcid05() {
        atStep(ApprovalStep.MANAGING_BODY);
        loginAs(bodyUser(10L));
        workflow.returnToDraft(proposal, RESOURCE, "Giảm số lượng");
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.DRAFT);
    }

    @Test
    @DisplayName("UTCID06 - N: từ chối có lý do → Bị từ chối, báo người lập")
    void utcid06() {
        atStep(ApprovalStep.SCHOOL);
        loginAs(schoolUser(1L));
        workflow.reject(proposal, RESOURCE, "Không đủ kinh phí");
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.REJECTED);
        assertThat(proposal.getRejectReason()).isEqualTo("Không đủ kinh phí");
        Object event = decided();
        assertThat(event).extracting("decision").hasToString("REJECTED");
        assertThat(event).extracting("recipientId").isEqualTo(100L);
    }

    @Test
    @DisplayName("UTCID07 - A: từ chối không ghi lý do")
    void utcid07() {
        atStep(ApprovalStep.SCHOOL);
        loginAs(schoolUser(1L));
        assertThatThrownBy(() -> workflow.reject(proposal, RESOURCE, null))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("Ghi lý do từ chối");
        verify(publisher, never()).publishEvent(any());
    }

    @Test
    @DisplayName("UTCID08 - B: lý do từ chối chỉ có khoảng trắng")
    void utcid08() {
        atStep(ApprovalStep.MANAGING_BODY);
        loginAs(bodyUser(10L));
        assertThatThrownBy(() -> workflow.reject(proposal, RESOURCE, " "))
                .hasMessageContaining("Ghi lý do từ chối");
    }

    @Test
    @DisplayName("UTCID09 - A: lãnh đạo trường từ chối ở bước Sở (MSG10)")
    void utcid09() {
        atStep(ApprovalStep.MANAGING_BODY);
        loginAs(schoolUser(1L));
        assertThatThrownBy(() -> workflow.reject(proposal, RESOURCE, "Không cần"))
                .hasMessageContaining("không thuộc cấp này");
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.PENDING);
    }

    @Test
    @DisplayName("UTCID10 - N: lãnh đạo Sở từ chối → Bị từ chối")
    void utcid10() {
        atStep(ApprovalStep.MANAGING_BODY);
        loginAs(bodyUser(10L));
        workflow.reject(proposal, RESOURCE, "Trùng đề xuất khác");
        assertThat(proposal.getStatus()).isEqualTo(VoucherStatus.REJECTED);
    }
}
