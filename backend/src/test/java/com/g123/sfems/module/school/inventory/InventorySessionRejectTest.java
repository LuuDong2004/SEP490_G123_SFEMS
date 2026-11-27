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

/** Sheet rejectSession — KK-06 3a Từ chối biên bản kiểm kê: {@link InventorySessionService#reject}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventorySessionRejectTest {

    static final String NOT_MY_TIER = "Phiếu đang chờ lãnh đạo trường duyệt — tài khoản của bạn không thuộc cấp này";

    InventoryFixture f;
    InventorySession session;
    InventoryLine line;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.leaderOfSchool(InventoryFixture.SCHOOL);
        line = InventoryFixture.counted(InventoryFixture.line(53332L, 1, f.projectorItem(24776L, "79.D2.14.TB.0001.19")), false, null,
                null);
        session = f.session(VoucherStatus.PENDING, line);
        session.setCode("KK-79000786-26-0001");
    }

    private void assertRefused(ThrowingCallable call, String message) {
        assertThatThrownBy(call).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verifyNoInteractions(f.events, f.publisher, f.lifecycle);
        verify(f.sessions, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: từ chối có lý do → Bị từ chối, sổ thiết bị giữ nguyên")
    void utcid01() {
        InventorySession result = f.sessionService.reject(84L, "Kiểm đếm sai phạm vi, lập biên bản mới");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.REJECTED);
        assertThat(result.getRejectReason()).isEqualTo("Kiểm đếm sai phạm vi, lập biên bản mới");
        verifyNoInteractions(f.lifecycle);
        assertThat(line.getEquipment().getCondition()).isEqualTo(EquipmentCondition.TOT);
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.REJECT);
        assertThat(f.publishedEvents()).singleElement().asString().startsWith("VoucherDecided")
                .contains("decision=REJECTED", "recipientId=289");
    }

    @Test
    @DisplayName("UTCID02 - A: từ chối không ghi lý do → \"Ghi lý do từ chối\"")
    void utcid02() {
        assertRefused(() -> f.sessionService.reject(84L, null), "Ghi lý do từ chối");
    }

    @Test
    @DisplayName("UTCID03 - A: từ chối biên bản còn Nháp → không từ chối được")
    void utcid03() {
        session.setStatus(VoucherStatus.DRAFT);
        session.setApprovalStep(null);
        assertRefused(() -> f.sessionService.reject(84L, "Kiểm đếm sai phạm vi, lập biên bản mới"),
                "Phiếu đang ở trạng thái \"nháp\", không từ chối được");
    }

    @Test
    @DisplayName("UTCID04 - A: từ chối biên bản đã Hoàn tất → không từ chối được")
    void utcid04() {
        session.setStatus(VoucherStatus.COMPLETED);
        session.setApprovalStep(null);
        assertRefused(() -> f.sessionService.reject(84L, "Kiểm đếm sai phạm vi, lập biên bản mới"),
                "Phiếu đang ở trạng thái \"hoàn tất\", không từ chối được");
    }
}
