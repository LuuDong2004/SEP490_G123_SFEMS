package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentHistory.Action;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.inventory.InventorySurplus;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.school.voucher.InventoryFindings;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet approveSession — KK-06 Duyệt biên bản kiểm kê, cập nhật sổ: {@link InventorySessionService#approve}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventorySessionApproveTest {

    static final String NOT_MY_TIER = "Phiếu đang chờ lãnh đạo trường duyệt — tài khoản của bạn không thuộc cấp này";

    InventoryFixture f;
    Equipment item;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.leaderOfSchool(1L);
    }

    /** Biên bản Chờ duyệt có đúng một dòng kiểm đếm. */
    private InventorySession pending(InventoryLine line) {
        InventorySession session = f.session(VoucherStatus.PENDING, line);
        session.setCode("KK-2026-00001");
        return session;
    }

    private InventoryLine projectorLine(String code, AssetStatus status) {
        item = f.item(11L, code, f.projector, f.room101, EquipmentCondition.TOT, status);
        return InventoryFixture.line(11L, 1, item);
    }

    private InventorySession approve(InventorySession session, String note) {
        InventorySession result = f.sessionService.approve(20L, note);
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.COMPLETED);
        assertThat(result.getCompletedAt()).isNotNull();
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction)
                .containsExactly(VoucherEvent.Action.APPROVE, VoucherEvent.Action.COMPLETE);
        verify(f.sessions).persist(session);
        return result;
    }

    private void assertNoSurplusDraft() {
        assertThat(f.publishedEvents()).noneMatch(e -> e instanceof InventoryFindings.Surplus);
    }

    private void assertRefused(InventorySession session, String message) {
        assertThatThrownBy(() -> f.sessionService.approve(20L, "Đồng ý")).isInstanceOf(FieldValidationException.class)
                .hasMessage(message);
        assertThat(session.getStatus()).isNotEqualTo(VoucherStatus.COMPLETED);
        verifyNoInteractions(f.lifecycle, f.events);
        verify(f.sessions, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: TB-001 khớp → Hoàn tất, ghi lịch sử \"khớp hệ thống\", báo người trình")
    void utcid01() {
        InventorySession session = pending(InventoryFixture.counted(projectorLine("TB-001", AssetStatus.IN_USE), true,
                f.room101, EquipmentCondition.TOT));
        approve(session, "Đồng ý");
        verify(f.lifecycle).event(eq(item), eq(Action.KIEM_KE), any(), eq("Kiểm kê: khớp hệ thống"));
        verifyNoMoreInteractions(f.lifecycle);
        assertThat(f.publishedEvents()).anySatisfy(e -> assertThat(String.valueOf(e)).startsWith("VoucherApproved"));
        assertNoSurplusDraft();
    }

    @Test
    @DisplayName("UTCID02 - N: TB-002 không thấy (đang dùng) → chuyển trạng thái Mất")
    void utcid02() {
        InventorySession session = pending(InventoryFixture.counted(projectorLine("TB-002", AssetStatus.IN_USE), false,
                null, null));
        approve(session, "Đồng ý");
        verify(f.lifecycle).status(eq(item), eq(AssetStatus.LOST), eq(Action.KIEM_KE), any(),
                eq("Kiểm kê: không tìm thấy — ghi mất"));
        verifyNoMoreInteractions(f.lifecycle);
    }

    @Test
    @DisplayName("UTCID03 - B: TB-002 không thấy, đã Mất từ trước → chỉ ghi lịch sử, trạng thái giữ nguyên")
    void utcid03() {
        InventorySession session = pending(InventoryFixture.counted(projectorLine("TB-002", AssetStatus.LOST), false,
                null, null));
        approve(session, "Đồng ý");
        verify(f.lifecycle).event(eq(item), eq(Action.KIEM_KE), any(), eq("Kiểm kê: không tìm thấy"));
        verifyNoMoreInteractions(f.lifecycle);
    }

    @Test
    @DisplayName("UTCID04 - N: TB-003 thấy hỏng (sổ: Tốt) → tình trạng Hỏng, trạng thái Hỏng chờ xử lý")
    void utcid04() {
        InventorySession session = pending(InventoryFixture.counted(projectorLine("TB-003", AssetStatus.IN_USE), true,
                f.room101, EquipmentCondition.HONG));
        approve(session, "Đồng ý");
        verify(f.lifecycle).condition(eq(item), eq(EquipmentCondition.HONG), eq(Action.KIEM_KE), any(),
                eq("Kiểm kê: phát hiện hỏng"));
        verify(f.lifecycle).status(eq(item), eq(AssetStatus.BROKEN), eq(Action.KIEM_KE), any(),
                eq("Kiểm kê: phát hiện hỏng"));
        verifyNoMoreInteractions(f.lifecycle);
    }

    @Test
    @DisplayName("UTCID05 - N: TB-004 thấy ở P102 (sổ: P101) → chuyển phòng theo thực tế")
    void utcid05() {
        InventorySession session = pending(InventoryFixture.counted(projectorLine("TB-004", AssetStatus.IN_USE), true,
                f.room102, EquipmentCondition.TOT));
        approve(session, "Đồng ý");
        verify(f.lifecycle).room(eq(item), eq(f.room102), eq(Action.KIEM_KE), any(),
                eq("Kiểm kê: thấy ở Phòng Tin 2, hệ thống ghi Phòng Tin 1"));
        verifyNoMoreInteractions(f.lifecycle);
    }

    @Test
    @DisplayName("UTCID06 - N: TB-005 thấy hỏng ở P102 → Hỏng + chuyển phòng (3 dòng lịch sử)")
    void utcid06() {
        InventorySession session = pending(InventoryFixture.counted(projectorLine("TB-005", AssetStatus.IN_USE), true,
                f.room102, EquipmentCondition.HONG));
        approve(session, "Đồng ý");
        verify(f.lifecycle).condition(eq(item), eq(EquipmentCondition.HONG), eq(Action.KIEM_KE), any(), any());
        verify(f.lifecycle).status(eq(item), eq(AssetStatus.BROKEN), eq(Action.KIEM_KE), any(), any());
        verify(f.lifecycle).room(eq(item), eq(f.room102), eq(Action.KIEM_KE), any(), any());
        verifyNoMoreInteractions(f.lifecycle);
    }

    @Test
    @DisplayName("UTCID07 - B: lô NaCl đếm 480 / 500 → chỉ ghi trên biên bản, sổ giữ 500")
    void utcid07() {
        Equipment lot = f.naclLot();
        InventoryLine line = InventoryFixture.counted(InventoryFixture.line(13L, 1, lot), true, null,
                EquipmentCondition.TOT);
        line.setCountedQuantity(new BigDecimal("480"));
        approve(pending(line), "Đồng ý");
        verifyNoInteractions(f.lifecycle);
        assertThat(lot.getQuantity()).isEqualByComparingTo("500");
    }

    @Test
    @DisplayName("UTCID08 - N: có 1 thiết bị thừa → lập phiếu ghi tăng Nháp nguồn Kiểm kê thừa (MSG15)")
    void utcid08() {
        InventorySession session = pending(InventoryFixture.counted(projectorLine("TB-001", AssetStatus.IN_USE), true,
                f.room101, EquipmentCondition.TOT));
        InventorySurplus surplus = new InventorySurplus();
        surplus.setLineNo(1);
        surplus.setCatalog(f.projector);
        surplus.setName("Máy chiếu");
        surplus.setQuantity(1);
        surplus.setRoom(f.room101);
        session.replaceSurplus(new ArrayList<>(List.of(surplus)));
        approve(session, "Đồng ý");
        assertThat(f.publishedEvents()).filteredOn(e -> e instanceof InventoryFindings.Surplus).singleElement()
                .isInstanceOfSatisfying(InventoryFindings.Surplus.class, s -> {
                    assertThat(s.schoolId()).isEqualTo(1L);
                    assertThat(s.sourceId()).isEqualTo(20L);
                    assertThat(s.sourceCode()).isEqualTo("KK-2026-00001");
                    assertThat(s.items()).singleElement().satisfies(i -> {
                        assertThat(i.catalogId()).isEqualTo(1L);
                        assertThat(i.quantity()).isEqualTo(1);
                        assertThat(i.roomId()).isEqualTo(101L);
                    });
                });
    }

    @Test
    @DisplayName("UTCID09 - B: không nhập ý kiến → Hoàn tất, nhật ký APPROVE note = null")
    void utcid09() {
        InventorySession session = pending(InventoryFixture.counted(projectorLine("TB-001", AssetStatus.IN_USE), true,
                f.room101, EquipmentCondition.TOT));
        approve(session, null);
        assertThat(f.recordedEvents().get(0).getNote()).isNull();
        assertNoSurplusDraft();
    }

    @Test
    @DisplayName("UTCID10 - A: lãnh đạo trường 2 duyệt biên bản trường 1 → MSG10")
    void utcid10() {
        f.leaderOfSchool(2L);
        InventorySession session = pending(projectorLine("TB-001", AssetStatus.IN_USE));
        assertRefused(session, NOT_MY_TIER);
    }

    @Test
    @DisplayName("UTCID11 - A: quản trị viên không thuộc cấp duyệt → MSG10")
    void utcid11() {
        f.admin();
        InventorySession session = pending(projectorLine("TB-001", AssetStatus.IN_USE));
        assertRefused(session, NOT_MY_TIER);
    }

    @Test
    @DisplayName("UTCID12 - A: biên bản còn Nháp → không duyệt được")
    void utcid12() {
        InventorySession session = f.session(VoucherStatus.DRAFT, projectorLine("TB-001", AssetStatus.IN_USE));
        assertRefused(session, "Phiếu đang ở trạng thái \"nháp\", không duyệt được");
    }
}
