package com.g123.sfems.module.school.procurement;

import static com.g123.sfems.module.school.procurement.ProcurementFixtures.catalog;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.line;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.plan;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.proposal;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sheet "cancelProposal" — PurchaseProposalService.cancel (NC-02, GBR-06: huỷ đề xuất). */
class PurchaseProposalServiceCancelTest extends PurchaseProposalServiceTestBase {

    PurchaseProposal draft;

    @BeforeEach
    void setUp() {
        draft = proposal(1L, school, VoucherStatus.DRAFT, line(11L, catalog(1L, "Máy chiếu"), 5, null));
        doReturn(draft).when(service).writable(1L);
    }

    @Test
    @DisplayName("UTCID01 - N: đề xuất nháp chưa vào kế hoạch → huỷ được")
    void utcid01() {
        service.cancel(1L, "Không cần nữa");
        verify(workflow).cancel(draft, PurchaseProposalService.RESOURCE, "Không cần nữa");
        verify(repository).persist(draft);
    }

    @Test
    @DisplayName("UTCID02 - A: đề xuất đang nằm trong kế hoạch → không huỷ được")
    void utcid02() {
        draft.setStatus(VoucherStatus.APPROVED);
        draft.setPlan(plan(5L, 10L, ProcurementPlan.Status.DRAFT));
        assertThatThrownBy(() -> service.cancel(1L, "Huỷ"))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("Đề xuất đang nằm trong kế hoạch \"Kế hoạch mua sắm 2027\"");
        verify(workflow, never()).cancel(any(), anyString(), any());
    }

    @Test
    @DisplayName("UTCID03 - A: đề xuất đã trình (Chờ duyệt) → workflow từ chối huỷ")
    void utcid03() {
        draft.setStatus(VoucherStatus.PENDING);
        doThrow(new FieldValidationException("status", "Phiếu đang ở trạng thái \"chờ duyệt\", không huỷ được"))
                .when(workflow).cancel(draft, PurchaseProposalService.RESOURCE, "Huỷ");
        assertThatThrownBy(() -> service.cancel(1L, "Huỷ")).hasMessageContaining("không huỷ được");
        verify(repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID04 - B: lý do huỷ null vẫn huỷ được (lý do không bắt buộc)")
    void utcid04() {
        service.cancel(1L, null);
        verify(workflow).cancel(draft, PurchaseProposalService.RESOURCE, null);
    }

    @Test
    @DisplayName("UTCID05 - A: hoàn tất đề xuất bằng tay luôn bị chặn")
    void utcid05() {
        assertThatThrownBy(() -> service.complete(1L, null))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("không hoàn tất bằng tay");
        verify(workflow, never()).complete(any(), anyString(), any());
    }
}
