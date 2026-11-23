package com.g123.sfems.module.school.procurement;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.school.voucher.DocumentNumberService;
import com.g123.sfems.module.school.voucher.InventoryFreeze;
import com.g123.sfems.module.school.voucher.VoucherEventRepository;
import com.g123.sfems.module.school.voucher.VoucherWorkflow;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.system.approvalflow.ApprovalFlowService;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Duyệt đề xuất mua sắm (NC-03 cấp trường, NC-04 cấp Sở) — logic nằm ở {@link VoucherWorkflow}, test bằng một
 * PurchaseProposal thật. Luồng duyệt của đề xuất: SCHOOL → MANAGING_BODY. Trường 1 thuộc Sở 10.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
abstract class ProposalWorkflowTestBase {

    static final String RESOURCE = "purchase_proposals";

    @Mock VoucherEventRepository events;
    @Mock DocumentNumberService numbers;
    @Mock RowLevelPrincipalResolver principals;
    @Mock ManagedSchoolsCache managedSchools;
    @Mock JdbcTemplate jdbc;
    @Mock ApprovalFlowService approvalFlows;
    @Mock ApplicationEventPublisher publisher;
    @Mock InventoryFreeze inventoryFreeze;

    VoucherWorkflow workflow;
    School school;
    PurchaseProposal proposal;

    @BeforeEach
    void baseSetUp() {
        workflow = new VoucherWorkflow(events, numbers, principals, managedSchools, jdbc, approvalFlows, publisher,
                inventoryFreeze);
        school = ProcurementFixtures.school(1L, 10L);
        proposal = ProcurementFixtures.proposal(1L, school, VoucherStatus.PENDING);
        proposal.setSubmittedById(100L);
        when(approvalFlows.chainOf(any())).thenReturn(List.of(ApprovalStep.SCHOOL, ApprovalStep.MANAGING_BODY));
    }

    void loginAs(RowLevelPrincipal principal) {
        when(principals.current()).thenReturn(Optional.ofNullable(principal));
    }

    /** Sự kiện duy nhất được publish (các record sự kiện là package-private của module voucher). */
    Object publishedEvent() {
        ArgumentCaptor<Object> event = ArgumentCaptor.forClass(Object.class);
        verify(publisher).publishEvent(event.capture());
        return event.getValue();
    }

    void atStep(ApprovalStep step) {
        proposal.setStatus(VoucherStatus.PENDING);
        proposal.setApprovalStep(step);
    }
}
