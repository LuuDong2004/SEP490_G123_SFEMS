package com.g123.sfems.domain.school.voucher;

import static com.g123.sfems.domain.school.voucher.ApprovalStep.MANAGING_BODY;
import static com.g123.sfems.domain.school.voucher.ApprovalStep.SCHOOL;
import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import org.junit.jupiter.api.Test;

/**
 * Cấp cao nhất phiếu từng lên tới ({@code reachedStep}) — thứ quyết định Sở / UBND có thấy phiếu không (125).
 * Đi theo đúng các lần {@code VoucherWorkflow} đặt cấp: trình, duyệt chuyển cấp, trả lại / từ chối / duyệt xong
 * (xoá cấp đang chờ), trình lại.
 */
class ReachedStepTest {

    @Test
    void furthestPicksTheHigherLevelAndTreatsNullAsNotYetSubmitted() {
        assertThat(ApprovalStep.furthest(null, null)).isNull();
        assertThat(ApprovalStep.furthest(null, SCHOOL)).isEqualTo(SCHOOL);
        assertThat(ApprovalStep.furthest(MANAGING_BODY, null)).isEqualTo(MANAGING_BODY);
        assertThat(ApprovalStep.furthest(SCHOOL, MANAGING_BODY)).isEqualTo(MANAGING_BODY);
        assertThat(ApprovalStep.furthest(MANAGING_BODY, SCHOOL)).isEqualTo(MANAGING_BODY);
    }

    @Test
    void draftHasReachedNothing() {
        assertThat(new PurchaseProposal().getReachedStep()).isNull();
    }

    @Test
    void pendingAtSchoolHasNotReachedTheManagingBody() {
        PurchaseProposal proposal = new PurchaseProposal();
        proposal.setApprovalStep(SCHOOL);            // cán bộ trình — chờ hiệu trưởng

        assertThat(proposal.getReachedStep()).isEqualTo(SCHOOL);
    }

    @Test
    void reachedStepNeverGoesBackWhenThePendingStepIsCleared() {
        PurchaseProposal proposal = new PurchaseProposal();
        proposal.setApprovalStep(SCHOOL);            // trình
        proposal.setApprovalStep(MANAGING_BODY);     // hiệu trưởng duyệt, lên UBND
        proposal.setApprovalStep(null);              // UBND trả lại (hoặc từ chối, hoặc duyệt xong)

        assertThat(proposal.getApprovalStep()).isNull();
        assertThat(proposal.getReachedStep()).isEqualTo(MANAGING_BODY);

        proposal.setApprovalStep(SCHOOL);            // trường trình lại — đứng chờ hiệu trưởng lần nữa
        assertThat(proposal.getReachedStep()).isEqualTo(MANAGING_BODY);
    }

    @Test
    void rejectedAtSchoolStaysAtSchool() {
        PurchaseProposal proposal = new PurchaseProposal();
        proposal.setApprovalStep(SCHOOL);
        proposal.setApprovalStep(null);              // hiệu trưởng từ chối

        assertThat(proposal.getReachedStep()).isEqualTo(SCHOOL);
    }
}
