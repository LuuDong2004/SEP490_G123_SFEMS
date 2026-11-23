package com.g123.sfems.module.school.procurement;

import static com.g123.sfems.module.school.procurement.ProcurementFixtures.catalog;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.line;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.proposal;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sheet "submitProposal" — PurchaseProposalService.submit (NC-02: trình đề xuất). */
class PurchaseProposalServiceSubmitTest extends PurchaseProposalServiceTestBase {

    EquipmentCatalog projector = catalog(1L, "Máy chiếu");
    EquipmentCatalog board = catalog(2L, "Bảng tương tác");
    PurchaseProposal draft;

    @BeforeEach
    void setUp() {
        draft = proposal(1L, school, VoucherStatus.DRAFT,
                line(11L, projector, 5, new BigDecimal("15000000")),
                line(12L, board, 2, new BigDecimal("40000000")));
        draft.setReason("Thiếu thiết bị so với định mức");
        doReturn(draft).when(service).writable(1L);
    }

    void expectError(String message) {
        assertThatThrownBy(() -> service.submit(1L))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining(message);
        verify(workflow, never()).submit(any(), any());
        verify(repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: đề xuất 2 dòng, có sự cần thiết → chuyển cho workflow trình")
    void utcid01() {
        when(workflow.submit(draft, PurchaseProposalService.RESOURCE)).thenReturn(false);
        PurchaseProposal result = service.submit(1L);
        assertThat(result).isSameAs(draft);
        verify(workflow).submit(draft, PurchaseProposalService.RESOURCE);
        verify(rowLevel).checkWritable(draft);
        verify(repository).persist(draft);
    }

    @Test
    @DisplayName("UTCID02 - A: chưa có dòng nào (MSG20)")
    void utcid02() {
        draft.replaceLines(List.of());
        expectError("Đề xuất chưa có dòng nào");
    }

    @Test
    @DisplayName("UTCID03 - A: chưa nêu sự cần thiết (MSG21)")
    void utcid03() {
        draft.setReason(null);
        expectError("Nêu sự cần thiết của đề xuất trước khi trình");
    }

    @Test
    @DisplayName("UTCID04 - B: đúng 1 dòng (số dòng nhỏ nhất)")
    void utcid04() {
        draft.replaceLines(List.of(line(11L, projector, 1, null)));
        service.submit(1L);
        verify(workflow).submit(draft, PurchaseProposalService.RESOURCE);
    }

    @Test
    @DisplayName("UTCID05 - A: hai dòng cùng thiết bị (MSG18)")
    void utcid05() {
        draft.replaceLines(List.of(line(11L, projector, 5, null), line(12L, projector, 1, null)));
        expectError("xuất hiện hai lần");
    }

    @Test
    @DisplayName("UTCID06 - B: năm ngân sách 2101")
    void utcid06() {
        draft.setBudgetYear(2101);
        expectError("Năm ngân sách không hợp lệ");
    }

    @Test
    @DisplayName("UTCID07 - N: dòng không có đơn giá vẫn trình được")
    void utcid07() {
        draft.replaceLines(List.of(line(11L, projector, 5, null)));
        service.submit(1L);
        verify(workflow).submit(draft, PurchaseProposalService.RESOURCE);
    }

    @Test
    @DisplayName("UTCID08 - A: năm học chưa chốt (ProposalSubmitGuard chặn)")
    void utcid08() {
        ProposalSubmitGuard guard = mock(ProposalSubmitGuard.class);
        doThrow(new FieldValidationException("schoolYear", "Năm học chưa chốt")).when(guard)
                .beforeSubmit(anyLong(), anyLong());
        service.setSubmitGuards(List.of(guard));
        expectError("Năm học chưa chốt");
        verify(guard).beforeSubmit(eq(1L), eq(1L));
    }

    @Test
    @DisplayName("UTCID09 - A: đề xuất không còn là Nháp (workflow từ chối trình)")
    void utcid09() {
        draft.setStatus(VoucherStatus.PENDING);
        when(workflow.submit(draft, PurchaseProposalService.RESOURCE))
                .thenThrow(new FieldValidationException("status", "Phiếu đang ở trạng thái \"chờ duyệt\", không trình được"));
        assertThatThrownBy(() -> service.submit(1L)).hasMessageContaining("không trình được");
        verify(repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID10 - N: luồng duyệt không có bước nào → trình là duyệt luôn")
    void utcid10() {
        when(workflow.submit(draft, PurchaseProposalService.RESOURCE)).thenReturn(true);
        service.submit(1L);
        verify(repository).persist(draft);
    }
}
