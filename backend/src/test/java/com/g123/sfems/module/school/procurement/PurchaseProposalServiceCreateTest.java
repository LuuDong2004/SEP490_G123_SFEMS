package com.g123.sfems.module.school.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sheet "createProposal" — PurchaseProposalService.create (NC-02: lập đề xuất mua sắm). */
class PurchaseProposalServiceCreateTest extends PurchaseProposalServiceTestBase {

    static final LocalDate TODAY = LocalDate.of(2026, 11, 23);

    @BeforeEach
    void setUp() {
        when(catalogs.get(1L)).thenReturn(ProcurementFixtures.catalog(1L, "Máy chiếu"));
        when(catalogs.get(2L)).thenReturn(ProcurementFixtures.catalog(2L, "Bảng tương tác"));
    }

    static PurchaseProposalApi.LineInput line(Long catalogId, Integer qty, Integer priority) {
        return new PurchaseProposalApi.LineInput(catalogId == null ? null : new IdRef(catalogId),
                PurchaseProposalLine.Kind.NEW, null, null, null, qty, new BigDecimal("15000000"), priority, null, null);
    }

    static PurchaseProposalApi.Request request(Integer budgetYear, PurchaseProposalApi.LineInput... lines) {
        return new PurchaseProposalApi.Request(new IdRef(1L), TODAY, budgetYear, FundingSource.STATE_BUDGET,
                "Thiếu thiết bị so với định mức", null, lines == null ? null : Arrays.asList(lines), null);
    }

    void expectError(PurchaseProposalApi.Request req, String message) {
        assertThatThrownBy(() -> service.create(req, req.school()))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining(message);
        verify(repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: đề xuất hợp lệ, năm ngân sách trống → năm sau, trạng thái Nháp")
    void utcid01() {
        PurchaseProposal p = service.create(request(null, line(1L, 5, 1)), new IdRef(1L));
        assertThat(p.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(p.getBudgetYear()).isEqualTo(2027);
        assertThat(p.getCode()).isNull();
        assertThat(p.getLines()).hasSize(1);
        PurchaseProposalLine l = p.getLines().get(0);
        assertThat(l.getName()).isEqualTo("Máy chiếu");
        assertThat(l.getCurrentQuantity()).isEqualTo(3);
        assertThat(l.getRequiredQuantity()).isEqualTo(10);
        verify(repository).persist(p);
    }

    @Test
    @DisplayName("UTCID02 - A: dòng chưa chọn thiết bị (MSG19)")
    void utcid02() {
        expectError(request(null, line(null, 5, 1)), "Dòng 1: chưa chọn nhóm thiết bị");
    }

    @Test
    @DisplayName("UTCID03 - B: số lượng = 0 (MSG19)")
    void utcid03() {
        expectError(request(null, line(1L, 0, 1)), "Dòng 1: số lượng phải lớn hơn 0");
    }

    @Test
    @DisplayName("UTCID04 - B: số lượng = 1 (nhỏ nhất hợp lệ)")
    void utcid04() {
        PurchaseProposal p = service.create(request(null, line(1L, 1, 1)), new IdRef(1L));
        assertThat(p.getLines().get(0).getQuantity()).isEqualTo(1);
    }

    @Test
    @DisplayName("UTCID05 - A: số lượng âm (MSG19)")
    void utcid05() {
        expectError(request(null, line(1L, -1, 1)), "số lượng phải lớn hơn 0");
    }

    @Test
    @DisplayName("UTCID06 - A: số lượng null (MSG19)")
    void utcid06() {
        expectError(request(null, line(1L, null, 1)), "số lượng phải lớn hơn 0");
    }

    @Test
    @DisplayName("UTCID07 - B: mức ưu tiên = 0")
    void utcid07() {
        expectError(request(null, line(1L, 5, 0)), "mức ưu tiên từ 1 đến 3");
    }

    @Test
    @DisplayName("UTCID08 - B: mức ưu tiên = 3")
    void utcid08() {
        PurchaseProposal p = service.create(request(null, line(1L, 5, 3)), new IdRef(1L));
        assertThat(p.getLines().get(0).getPriority()).isEqualTo(3);
    }

    @Test
    @DisplayName("UTCID09 - B: mức ưu tiên = 4")
    void utcid09() {
        expectError(request(null, line(1L, 5, 4)), "mức ưu tiên từ 1 đến 3");
    }

    @Test
    @DisplayName("UTCID10 - A: một thiết bị chọn hai lần (MSG18)")
    void utcid10() {
        expectError(request(null, line(1L, 5, 1), line(1L, 2, 2)), "xuất hiện hai lần");
    }

    @Test
    @DisplayName("UTCID11 - B: năm ngân sách = 2000")
    void utcid11() {
        assertThat(service.create(request(2000, line(1L, 5, 1)), new IdRef(1L)).getBudgetYear()).isEqualTo(2000);
    }

    @Test
    @DisplayName("UTCID12 - B: năm ngân sách = 1999")
    void utcid12() {
        expectError(request(1999, line(1L, 5, 1)), "Năm ngân sách không hợp lệ");
    }

    @Test
    @DisplayName("UTCID13 - B: năm ngân sách = 2100")
    void utcid13() {
        assertThat(service.create(request(2100, line(1L, 5, 1)), new IdRef(1L)).getBudgetYear()).isEqualTo(2100);
    }

    @Test
    @DisplayName("UTCID14 - B: năm ngân sách = 2101")
    void utcid14() {
        expectError(request(2101, line(1L, 5, 1)), "Năm ngân sách không hợp lệ");
    }

    @Test
    @DisplayName("UTCID15 - A: không truyền trường, tài khoản không thuộc trường nào")
    void utcid15() {
        when(principals.current()).thenReturn(Optional.of(ProcurementFixtures.bodyUser(10L)));
        PurchaseProposalApi.Request req = request(null, line(1L, 5, 1));
        assertThatThrownBy(() -> service.create(req, null))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("Chọn trường");
    }

    @Test
    @DisplayName("UTCID16 - N: không truyền trường → lấy trường của tài khoản; chưa có dòng vẫn lưu nháp")
    void utcid16() {
        when(principals.current()).thenReturn(Optional.of(ProcurementFixtures.schoolUser(1L)));
        PurchaseProposal p = service.create(request(null, (PurchaseProposalApi.LineInput[]) null), null);
        assertThat(p.getSchool()).isSameAs(school);
        assertThat(p.getLines()).isEmpty();
        assertThat(p.getStatus()).isEqualTo(VoucherStatus.DRAFT);
    }

    @Test
    @DisplayName("UTCID17 - N: hai thiết bị khác nhau, lý do có khoảng trắng được trim")
    void utcid17() {
        PurchaseProposalApi.Request req = new PurchaseProposalApi.Request(new IdRef(1L), TODAY, 2027,
                FundingSource.STATE_BUDGET, "  Bổ sung phòng học  ", null, List.of(line(1L, 5, 1), line(2L, 2, 2)),
                null);
        PurchaseProposal p = service.create(req, new IdRef(1L));
        assertThat(p.getReason()).isEqualTo("Bổ sung phòng học");
        assertThat(p.getLines()).extracting(PurchaseProposalLine::getLineNo).containsExactly(1, 2);
    }
}
