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
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet rejectIntake — PN-03 4a Từ chối phiếu ghi tăng: {@link EquipmentIntakeService#reject}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class EquipmentIntakeRejectTest {

    static final String NOT_MY_TIER = "Phiếu đang chờ lãnh đạo trường duyệt — tài khoản của bạn không thuộc cấp này";

    IntakeFixture f;
    EquipmentIntake intake;

    @BeforeEach
    void setUp() {
        f = new IntakeFixture();
        f.leaderOfSchool(IntakeFixture.SCHOOL);
        intake = f.intake(VoucherStatus.PENDING);
        intake.setCode("NK-79000786-26-0002");
        f.stored(intake);
    }

    /** Lỗi: không ghi nhật ký, không publish thông báo, không lưu. */
    private void assertRefused(ThrowingCallable call, String message) {
        assertThatThrownBy(call).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verifyNoInteractions(f.events, f.publisher);
        verify(f.repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: từ chối có lý do → Bị từ chối, không sinh thiết bị, báo người trình Nguyễn Vũ Nghĩa")
    void utcid01() {
        EquipmentIntake result = f.service.reject(311L, "Hàng không đúng hợp đồng");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.REJECTED);
        assertThat(result.getRejectReason()).isEqualTo("Hàng không đúng hợp đồng");
        verifyNoInteractions(f.equipment);
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.REJECT);
        assertThat(f.publishedEvents()).singleElement().asString().startsWith("VoucherDecided")
                .contains("decision=REJECTED", "recipientId=289");
    }

    @Test
    @DisplayName("UTCID02 - A: từ chối không ghi lý do → \"Ghi lý do từ chối\"")
    void utcid02() {
        assertRefused(() -> f.service.reject(311L, null), "Ghi lý do từ chối");
    }

    @Test
    @DisplayName("UTCID03 - B: lý do từ chối chỉ khoảng trắng → \"Ghi lý do từ chối\"")
    void utcid03() {
        assertRefused(() -> f.service.reject(311L, "   "), "Ghi lý do từ chối");
    }

    @Test
    @DisplayName("UTCID04 - A: từ chối phiếu đã Hoàn tất → không từ chối được")
    void utcid04() {
        intake.setStatus(VoucherStatus.COMPLETED);
        intake.setApprovalStep(null);
        assertRefused(() -> f.service.reject(311L, "Hàng không đúng hợp đồng"),
                "Phiếu đang ở trạng thái \"hoàn tất\", không từ chối được");
    }

    @Test
    @DisplayName("UTCID05 - A: hiệu trưởng THPT An Lạc Lê Bảo Nam từ chối phiếu của THPT An Nghĩa → không tìm thấy phiếu")
    void utcid05() {
        f.leaderOfSchool(IntakeFixture.OTHER_SCHOOL);
        f.stored(null);
        assertThatThrownBy(() -> f.service.reject(311L, "Hàng không đúng hợp đồng")).isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy phiếu ghi tăng (mã số 311) — có thể đã bị xoá hoặc nằm ngoài phạm vi dữ liệu của bạn");
        verify(f.repository, never()).persist(any());
    }
}
