package com.g123.sfems.module.school.intake;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet returnRejectIntake — PN-03 4a Trả lại / Từ chối: {@link EquipmentIntakeService#returnToDraft}, {@code reject}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class EquipmentIntakeReturnRejectTest {

    static final String NOT_MY_TIER = "Phiếu đang chờ lãnh đạo trường duyệt — tài khoản của bạn không thuộc cấp này";

    IntakeFixture f;
    EquipmentIntake intake;

    @BeforeEach
    void setUp() {
        f = new IntakeFixture();
        f.leaderOfSchool(1L);
        intake = f.intake(VoucherStatus.PENDING);
        intake.setCode("NK-2026-00001");
        f.stored(intake);
    }

    /** Lỗi: không ghi nhật ký, không publish thông báo, không lưu. */
    private void assertRefused(ThrowingCallable call, String message) {
        assertThatThrownBy(call).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verifyNoInteractions(f.events, f.publisher);
        verify(f.repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: trả lại có lý do → Nháp, returnNote đã trim, giữ số, báo người trình id 100")
    void utcid01() {
        EquipmentIntake result = f.service.returnToDraft(10L, "  Bổ sung tệp hoá đơn  ");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(result.getReturnNote()).isEqualTo("Bổ sung tệp hoá đơn");
        assertThat(result.getApprovalStep()).isNull();
        assertThat(result.getCode()).isEqualTo("NK-2026-00001");
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.RETURN);
        assertThat(f.publishedEvents()).singleElement().asString().startsWith("VoucherDecided")
                .contains("decision=RETURNED", "recipientId=100");
    }

    @Test
    @DisplayName("UTCID02 - A: trả lại không ghi lý do → GBR-04")
    void utcid02() {
        assertRefused(() -> f.service.returnToDraft(10L, null), "Ghi rõ cần sửa gì trước khi trả lại");
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.PENDING);
    }

    @Test
    @DisplayName("UTCID03 - B: lý do trả lại chỉ khoảng trắng → GBR-04")
    void utcid03() {
        assertRefused(() -> f.service.returnToDraft(10L, "   "), "Ghi rõ cần sửa gì trước khi trả lại");
    }

    @Test
    @DisplayName("UTCID04 - A: trả lại phiếu còn Nháp → không trả lại được")
    void utcid04() {
        intake.setStatus(VoucherStatus.DRAFT);
        intake.setApprovalStep(null);
        assertRefused(() -> f.service.returnToDraft(10L, "  Bổ sung tệp hoá đơn  "),
                "Phiếu đang ở trạng thái \"nháp\", không trả lại được");
    }

    @Test
    @DisplayName("UTCID05 - A: lãnh đạo trường 2 trả lại phiếu trường 1 → MSG10")
    void utcid05() {
        f.leaderOfSchool(2L);
        assertRefused(() -> f.service.returnToDraft(10L, "  Bổ sung tệp hoá đơn  "), NOT_MY_TIER);
    }

    @Test
    @DisplayName("UTCID06 - N: từ chối có lý do → Bị từ chối, không sinh thiết bị, báo người trình id 100")
    void utcid06() {
        EquipmentIntake result = f.service.reject(10L, "Hàng không đúng hợp đồng");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.REJECTED);
        assertThat(result.getRejectReason()).isEqualTo("Hàng không đúng hợp đồng");
        verifyNoInteractions(f.equipment);
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.REJECT);
        assertThat(f.publishedEvents()).singleElement().asString().startsWith("VoucherDecided")
                .contains("decision=REJECTED", "recipientId=100");
    }

    @Test
    @DisplayName("UTCID07 - A: từ chối không ghi lý do → \"Ghi lý do từ chối\"")
    void utcid07() {
        assertRefused(() -> f.service.reject(10L, null), "Ghi lý do từ chối");
    }

    @Test
    @DisplayName("UTCID08 - B: lý do từ chối chỉ khoảng trắng → \"Ghi lý do từ chối\"")
    void utcid08() {
        assertRefused(() -> f.service.reject(10L, "   "), "Ghi lý do từ chối");
    }

    @Test
    @DisplayName("UTCID09 - A: từ chối phiếu đã Hoàn tất → không từ chối được")
    void utcid09() {
        intake.setStatus(VoucherStatus.COMPLETED);
        intake.setApprovalStep(null);
        assertRefused(() -> f.service.reject(10L, "Hàng không đúng hợp đồng"),
                "Phiếu đang ở trạng thái \"hoàn tất\", không từ chối được");
    }

    @Test
    @DisplayName("UTCID10 - A: lãnh đạo trường 2 từ chối phiếu trường 1 → MSG10")
    void utcid10() {
        f.leaderOfSchool(2L);
        assertRefused(() -> f.service.reject(10L, "Hàng không đúng hợp đồng"), NOT_MY_TIER);
    }
}
