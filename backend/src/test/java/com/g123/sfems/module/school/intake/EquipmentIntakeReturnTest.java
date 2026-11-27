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

/** Sheet returnIntake — PN-03 4a Trả lại phiếu ghi tăng: {@link EquipmentIntakeService#returnToDraft}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class EquipmentIntakeReturnTest {

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
    @DisplayName("UTCID01 - N: trả lại có lý do → Nháp, returnNote đã trim, giữ số, báo người trình Nguyễn Vũ Nghĩa")
    void utcid01() {
        EquipmentIntake result = f.service.returnToDraft(311L, "  Bổ sung tệp hoá đơn  ");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(result.getReturnNote()).isEqualTo("Bổ sung tệp hoá đơn");
        assertThat(result.getApprovalStep()).isNull();
        assertThat(result.getCode()).isEqualTo("NK-79000786-26-0002");
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.RETURN);
        assertThat(f.publishedEvents()).singleElement().asString().startsWith("VoucherDecided")
                .contains("decision=RETURNED", "recipientId=289");
    }

    @Test
    @DisplayName("UTCID02 - A: trả lại không ghi lý do → GBR-04")
    void utcid02() {
        assertRefused(() -> f.service.returnToDraft(311L, null), "Ghi rõ cần sửa gì trước khi trả lại");
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.PENDING);
    }

    @Test
    @DisplayName("UTCID03 - B: lý do trả lại chỉ khoảng trắng → GBR-04")
    void utcid03() {
        assertRefused(() -> f.service.returnToDraft(311L, "   "), "Ghi rõ cần sửa gì trước khi trả lại");
    }

    @Test
    @DisplayName("UTCID04 - A: trả lại phiếu còn Nháp (hiệu trưởng không thấy phiếu nháp) → không tìm thấy phiếu")
    void utcid04() {
        intake.setStatus(VoucherStatus.DRAFT);
        intake.setApprovalStep(null);
        f.stored(null);
        assertThatThrownBy(() -> f.service.returnToDraft(311L, "Bổ sung tệp hoá đơn")).isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy phiếu ghi tăng (mã số 311) — có thể đã bị xoá hoặc nằm ngoài phạm vi dữ liệu của bạn");
        verify(f.repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID05 - A: hiệu trưởng THPT An Lạc Lê Bảo Nam trả lại phiếu của THPT An Nghĩa → không tìm thấy phiếu")
    void utcid05() {
        f.leaderOfSchool(IntakeFixture.OTHER_SCHOOL);
        f.stored(null);
        assertThatThrownBy(() -> f.service.returnToDraft(311L, "Bổ sung tệp hoá đơn")).isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy phiếu ghi tăng (mã số 311) — có thể đã bị xoá hoặc nằm ngoài phạm vi dữ liệu của bạn");
        verify(f.repository, never()).persist(any());
    }
}
