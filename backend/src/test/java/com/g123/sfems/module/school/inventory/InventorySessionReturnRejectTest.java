package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet returnRejectSession — KK-06 3a Trả lại / Từ chối biên bản: {@code returnToDraft}, {@code reject}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventorySessionReturnRejectTest {

    static final String NOT_MY_TIER = "Phiếu đang chờ lãnh đạo trường duyệt — tài khoản của bạn không thuộc cấp này";

    InventoryFixture f;
    InventorySession session;
    InventoryLine line;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.leaderOfSchool(1L);
        line = InventoryFixture.counted(InventoryFixture.line(11L, 1, f.projectorItem(11L, "TB-001")), false, null,
                null);
        session = f.session(VoucherStatus.PENDING, line);
        session.setCode("KK-2026-00001");
    }

    private void assertRefused(ThrowingCallable call, String message) {
        assertThatThrownBy(call).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verifyNoInteractions(f.events, f.publisher, f.lifecycle);
        verify(f.sessions, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: trả lại có lý do → Nháp, giữ số, kết quả kiểm đếm giữ nguyên, báo người trình")
    void utcid01() {
        InventorySession result = f.sessionService.returnToDraft(20L, "  Kiểm lại phòng Tin 2  ");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(result.getReturnNote()).isEqualTo("Kiểm lại phòng Tin 2");
        assertThat(result.getCode()).isEqualTo("KK-2026-00001");
        assertThat(line.getFound()).isFalse();
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.RETURN);
        assertThat(f.publishedEvents()).singleElement().asString().startsWith("VoucherDecided")
                .contains("decision=RETURNED", "recipientId=100");
        verifyNoInteractions(f.lifecycle);
    }

    @Test
    @DisplayName("UTCID02 - A: trả lại không ghi lý do → GBR-04")
    void utcid02() {
        assertRefused(() -> f.sessionService.returnToDraft(20L, null), "Ghi rõ cần sửa gì trước khi trả lại");
    }

    @Test
    @DisplayName("UTCID03 - B: lý do trả lại chỉ khoảng trắng → GBR-04")
    void utcid03() {
        assertRefused(() -> f.sessionService.returnToDraft(20L, "   "), "Ghi rõ cần sửa gì trước khi trả lại");
    }

    @Test
    @DisplayName("UTCID04 - A: lãnh đạo trường 2 trả lại biên bản trường 1 → MSG10")
    void utcid04() {
        f.leaderOfSchool(2L);
        assertRefused(() -> f.sessionService.returnToDraft(20L, "  Kiểm lại phòng Tin 2  "), NOT_MY_TIER);
    }

    @Test
    @DisplayName("UTCID05 - N: từ chối có lý do → Bị từ chối, sổ thiết bị giữ nguyên")
    void utcid05() {
        InventorySession result = f.sessionService.reject(20L, "Kết quả không đáng tin");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.REJECTED);
        assertThat(result.getRejectReason()).isEqualTo("Kết quả không đáng tin");
        verifyNoInteractions(f.lifecycle);
        assertThat(line.getEquipment().getCondition()).isEqualTo(EquipmentCondition.TOT);
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.REJECT);
        assertThat(f.publishedEvents()).singleElement().asString().startsWith("VoucherDecided")
                .contains("decision=REJECTED", "recipientId=100");
    }

    @Test
    @DisplayName("UTCID06 - A: từ chối không ghi lý do → \"Ghi lý do từ chối\"")
    void utcid06() {
        assertRefused(() -> f.sessionService.reject(20L, null), "Ghi lý do từ chối");
    }

    @Test
    @DisplayName("UTCID07 - A: từ chối biên bản còn Nháp → không từ chối được")
    void utcid07() {
        session.setStatus(VoucherStatus.DRAFT);
        session.setApprovalStep(null);
        assertRefused(() -> f.sessionService.reject(20L, "Kết quả không đáng tin"),
                "Phiếu đang ở trạng thái \"nháp\", không từ chối được");
    }

    @Test
    @DisplayName("UTCID08 - A: từ chối biên bản đã Hoàn tất → không từ chối được")
    void utcid08() {
        session.setStatus(VoucherStatus.COMPLETED);
        session.setApprovalStep(null);
        assertRefused(() -> f.sessionService.reject(20L, "Kết quả không đáng tin"),
                "Phiếu đang ở trạng thái \"hoàn tất\", không từ chối được");
    }
}
