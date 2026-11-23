package com.g123.sfems.module.school.procurement;

import static com.g123.sfems.module.school.procurement.ProcurementFixtures.catalog;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.line;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.plan;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.proposal;
import static com.g123.sfems.module.school.procurement.ProcurementFixtures.school;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.function.Supplier;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.RowCallbackHandler;

/** Sheet "setPlanProposals" — ProcurementPlanService.setProposals (NC-05 bước 3–4: chọn đề xuất đã duyệt). */
class ProcurementPlanServiceSetProposalsTest extends ProcurementPlanServiceTestBase {

    ProcurementPlan plan;
    PurchaseProposal approved;
    /** Đề xuất đang nằm trong kế hoạch này (trước khi gọi). */
    List<PurchaseProposal> current = new ArrayList<>();
    /** Đề xuất người dùng xem được trong số id truyền vào. */
    List<PurchaseProposal> visible = new ArrayList<>();
    /** plan_id đang giữ mỗi đề xuất, đọc trong câu SELECT ... FOR UPDATE. */
    Map<Long, Long> lockedPlan = new HashMap<>();

    @BeforeEach
    void setUp() throws Exception {
        plan = plan(1L, 10L, ProcurementPlan.Status.DRAFT);
        givenPlan(plan);
        approved = proposal(21L, school(1L, 10L), VoucherStatus.APPROVED,
                line(211L, catalog(1L, "Máy chiếu"), 5, new BigDecimal("15000000")));
        when(managedSchools.bodyOf(1L)).thenReturn(10L);
        when(managedSchools.bodyOf(2L)).thenReturn(20L);

        when(rowLevel.<List<PurchaseProposal>>asSystem(eq("procurement_plans.proposals"), any(Supplier.class))).thenReturn(current);
        Specification<PurchaseProposal> all = (root, q, cb) -> null;
        when(rowLevel.scope(eq(PurchaseProposal.class), any())).thenReturn(all);
        when(proposals.findAll(any(Specification.class))).thenReturn(visible);
        doAnswer(inv -> {
            RowCallbackHandler handler = inv.getArgument(1);
            for (Map.Entry<Long, Long> e : lockedPlan.entrySet()) {
                ResultSet rs = mock(ResultSet.class);
                when(rs.getLong(1)).thenReturn(e.getKey());
                when(rs.getLong(2)).thenReturn(e.getValue() == null ? 0L : e.getValue());
                when(rs.wasNull()).thenReturn(e.getValue() == null);
                handler.processRow(rs);
            }
            return null;
        }).when(jdbc).query(startsWith("SELECT id, plan_id FROM purchase_proposals"), any(RowCallbackHandler.class),
                ArgumentMatchers.<Object>any());
    }

    void givenCandidate(PurchaseProposal p, Long heldByPlan) {
        visible.add(p);
        lockedPlan.put(p.getId(), heldByPlan);
    }

    void expectError(List<Long> ids, String message) {
        assertThatThrownBy(() -> service.setProposals(1L, ids))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining(message);
    }

    @Test
    @DisplayName("UTCID01 - N: thêm đề xuất đã duyệt chưa vào kế hoạch nào → vào kế hoạch, đủ số đề nghị")
    void utcid01() {
        givenCandidate(approved, null);
        service.setProposals(1L, List.of(21L));
        assertThat(approved.getPlan()).isSameAs(plan);
        PurchaseProposalLine l = approved.getLines().get(0);
        assertThat(l.getPlannedQuantity()).isEqualTo(5);
        assertThat(l.getPlannedUnitPrice()).isNull();
        verify(proposals).persist(approved);
    }

    @Test
    @DisplayName("UTCID02 - N: danh sách rỗng → rút đề xuất đang có ra khỏi kế hoạch")
    void utcid02() {
        approved.setPlan(plan);
        approved.getLines().get(0).setPlannedQuantity(3);
        approved.getLines().get(0).setPlannedUnitPrice(new BigDecimal("12000000"));
        current.add(approved);
        service.setProposals(1L, List.of());
        assertThat(approved.getPlan()).isNull();
        assertThat(approved.getLines().get(0).getPlannedQuantity()).isNull();
        assertThat(approved.getLines().get(0).getPlannedUnitPrice()).isNull();
        verify(proposals).persist(approved);
    }

    @Test
    @DisplayName("UTCID03 - A: đề xuất chưa được duyệt (MSG24)")
    void utcid03() {
        approved.setStatus(VoucherStatus.PENDING);
        givenCandidate(approved, null);
        expectError(List.of(21L), "chưa được duyệt hoặc đã nằm trong kế hoạch khác");
    }

    @Test
    @DisplayName("UTCID04 - A: đề xuất đã nằm trong kế hoạch khác (MSG24)")
    void utcid04() {
        givenCandidate(approved, 2L);
        expectError(List.of(21L), "chưa được duyệt hoặc đã nằm trong kế hoạch khác");
        assertThat(approved.getPlan()).isNull();
    }

    @Test
    @DisplayName("UTCID05 - N: đề xuất đã ở chính kế hoạch này → giữ nguyên, không ghi lại")
    void utcid05() {
        approved.setPlan(plan);
        approved.getLines().get(0).setPlannedQuantity(2);
        current.add(approved);
        givenCandidate(approved, 1L);
        service.setProposals(1L, List.of(21L));
        assertThat(approved.getLines().get(0).getPlannedQuantity()).isEqualTo(2);
        verify(proposals, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID06 - A: id đề xuất không tồn tại / không xem được")
    void utcid06() {
        lockedPlan.put(99L, null);
        expectError(List.of(99L), "Có đề xuất không tồn tại hoặc bạn không xem được");
    }

    @Test
    @DisplayName("UTCID07 - A: đề xuất của trường thuộc Sở khác")
    void utcid07() {
        PurchaseProposal other = proposal(22L, school(2L, 20L), VoucherStatus.APPROVED,
                line(221L, catalog(1L, "Máy chiếu"), 1, null));
        givenCandidate(other, null);
        expectError(List.of(22L), "không thuộc cơ quan lập kế hoạch");
    }

    @Test
    @DisplayName("UTCID08 - A: kế hoạch không còn là Nháp")
    void utcid08() {
        plan.setStatus(ProcurementPlan.Status.PENDING);
        expectError(List.of(21L), "Chỉ sửa được kế hoạch nháp");
    }

    @Test
    @DisplayName("UTCID09 - A: chuyên viên Sở khác sửa kế hoạch")
    void utcid09() {
        loginAs(ProcurementFixtures.bodyUser(20L));
        expectError(List.of(21L), "Chỉ cơ quan lập kế hoạch mới sửa được kế hoạch này");
    }

    @Test
    @DisplayName("UTCID10 - B: danh sách null → coi như rỗng, không lỗi")
    void utcid10() {
        assertThat(service.setProposals(1L, null)).isSameAs(plan);
        verify(proposals, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID11 - A: đề xuất đã Hoàn tất (MSG24)")
    void utcid11() {
        approved.setStatus(VoucherStatus.COMPLETED);
        givenCandidate(approved, null);
        expectError(List.of(21L), "chưa được duyệt hoặc đã nằm trong kế hoạch khác");
    }
}
