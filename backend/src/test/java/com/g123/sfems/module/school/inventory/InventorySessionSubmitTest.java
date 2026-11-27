package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentHistory.Action;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet submitSession — KK-05 Trình biên bản kiểm kê: {@link InventorySessionService#submit}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventorySessionSubmitTest {

    static final String NO_COUNCIL = "Chưa khai tổ kiểm kê — sửa phiếu, chọn người trong tổ rồi trình lại biên bản";

    InventoryFixture f;
    InventoryLine l1;
    InventoryLine l2;
    InventoryLine l3;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.officerOfSchool1();
        l1 = InventoryFixture.counted(InventoryFixture.line(53332L, 1, f.projectorItem(24776L, "79.D2.14.TB.0001.19")), true, f.room101,
                EquipmentCondition.TOT);
        l2 = InventoryFixture.counted(InventoryFixture.line(53337L, 2, f.projectorItem(24777L, "79.D2.14.TB.0002.19")), true, f.room101,
                EquipmentCondition.TOT);
        l3 = InventoryFixture.counted(InventoryFixture.line(53342L, 3, f.projectorItem(24778L, "79.D2.14.TB.0003.19")), false, null, null);
    }

    private void assertAwaitingLeader(InventorySession result) {
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.PENDING);
        assertThat(result.getApprovalStep()).isEqualTo(ApprovalStep.SCHOOL);
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.SUBMIT);
        assertThat(f.publishedEvents()).singleElement().asString().startsWith("VoucherAwaiting")
                .contains("step=SCHOOL", "schoolId=1503");
        verify(f.sessions).persist(result);
    }

    private void assertRefused(InventorySession session, String message) {
        assertThatThrownBy(() -> f.sessionService.submit(84L)).isInstanceOf(FieldValidationException.class)
                .hasMessage(message);
        assertThat(session.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(session.getCode()).isNull();
        verifyNoInteractions(f.numbers, f.events);
        verify(f.sessions, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: mọi dòng đã kiểm, có tổ kiểm kê → Chờ duyệt, số KK-79000786-26-0001 (MSG08)")
    void utcid01() {
        f.session(VoucherStatus.DRAFT, l1, l2, l3);
        InventorySession result = f.sessionService.submit(84L);
        assertThat(result.getCode()).isEqualTo("KK-79000786-26-0001");
        assertAwaitingLeader(result);
    }

    @Test
    @DisplayName("UTCID02 - N: biên bản bị trả lại đã có số → trình lại giữ số KK-79000786-26-0001")
    void utcid02() {
        InventorySession session = f.session(VoucherStatus.DRAFT, l1, l2, l3);
        session.setCode("KK-79000786-26-0001");
        InventorySession result = f.sessionService.submit(84L);
        assertThat(result.getCode()).isEqualTo("KK-79000786-26-0001");
        verifyNoInteractions(f.numbers);
        assertAwaitingLeader(result);
    }

    @Test
    @DisplayName("UTCID03 - B: biên bản 0 dòng (sổ trống) → không còn dòng chưa kiểm, trình được")
    void utcid03() {
        f.session(VoucherStatus.DRAFT);
        InventorySession result = f.sessionService.submit(84L);
        assertThat(result.getCode()).isEqualTo("KK-79000786-26-0001");
        assertAwaitingLeader(result);
    }

    @Test
    @DisplayName("UTCID04 - A: còn 1 dòng chưa kiểm → MSG45")
    void utcid04() {
        l3.setFound(null);
        InventorySession session = f.session(VoucherStatus.DRAFT, l1, l2, l3);
        assertRefused(session, "Còn 1 thiết bị chưa kiểm — ghi \"có\" hoặc \"không thấy\" cho mọi dòng trước khi "
                + "trình biên bản");
    }

    @Test
    @DisplayName("UTCID05 - A: chưa có tổ kiểm kê → MSG52")
    void utcid05() {
        InventorySession session = f.session(VoucherStatus.DRAFT, l1, l2, l3);
        session.setCouncil(null);
        assertRefused(session, NO_COUNCIL);
    }

    @Test
    @DisplayName("UTCID06 - B: tổ kiểm kê chỉ khoảng trắng → MSG52")
    void utcid06() {
        InventorySession session = f.session(VoucherStatus.DRAFT, l1, l2, l3);
        session.setCouncil("   ");
        assertRefused(session, NO_COUNCIL);
    }

    @Test
    @DisplayName("UTCID07 - A: biên bản đang Chờ duyệt → không trình lại được")
    void utcid07() {
        InventorySession session = f.session(VoucherStatus.PENDING, l1, l2, l3);
        session.setCode("KK-79000786-26-0001");
        assertThatThrownBy(() -> f.sessionService.submit(84L)).isInstanceOf(FieldValidationException.class)
                .hasMessage("Phiếu đang ở trạng thái \"chờ duyệt\", không trình được");
        verifyNoInteractions(f.events);
    }

    @Test
    @DisplayName("UTCID08 - N: luồng duyệt rỗng → Hoàn tất ngay, sổ thiết bị được cập nhật")
    void utcid08() {
        when(f.approvalFlows.chainOf(any())).thenReturn(List.of());
        f.session(VoucherStatus.DRAFT, l1, l2, l3);
        InventorySession result = f.sessionService.submit(84L);
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.COMPLETED);
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction)
                .containsExactly(VoucherEvent.Action.SUBMIT, VoucherEvent.Action.COMPLETE);
        assertThat(f.publishedEvents()).noneMatch(e -> String.valueOf(e).startsWith("VoucherAwaiting"));
        verify(f.lifecycle, times(2)).event(any(), eq(Action.KIEM_KE), any(), eq("Kiểm kê: khớp hệ thống"));
        verify(f.lifecycle).status(eq(l3.getEquipment()), eq(AssetStatus.LOST), eq(Action.KIEM_KE), any(),
                eq("Kiểm kê: không tìm thấy — ghi mất"));
    }

    @Test
    @DisplayName("UTCID09 - A: biên bản theo đợt \"Kiểm kê toàn địa bàn năm học 2026-2027\" đã đóng → không trình được")
    void utcid09() {
        InventorySession session = f.session(VoucherStatus.DRAFT, l1, l2, l3);
        session.setCampaign(f.campaign(20L, true));
        assertRefused(session, "Đợt \"Kiểm kê toàn địa bàn năm học 2026-2027\" đã đóng, không trình biên bản của đợt"
                + " này được nữa. Huỷ phiếu nháp này, hoặc đề nghị cơ quan phát động mở lại đợt.");
    }

    @Test
    @DisplayName("UTCID10 - N: biên bản theo đợt \"Kiểm kê toàn địa bàn năm học 2026-2027\" còn mở → Chờ duyệt")
    void utcid10() {
        InventorySession session = f.session(VoucherStatus.DRAFT, l1, l2, l3);
        session.setCampaign(f.campaign(20L, false));
        assertAwaitingLeader(f.sessionService.submit(84L));
    }
}
