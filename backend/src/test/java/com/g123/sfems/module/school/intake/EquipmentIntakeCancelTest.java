package com.g123.sfems.module.school.intake;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet cancelIntake — PN-01 Huỷ phiếu ghi tăng: {@link EquipmentIntakeService#cancel}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class EquipmentIntakeCancelTest {

    static final String ALREADY_SUBMITTED =
            "Phiếu đã từng được trình, không xoá được — nó đã có số và nhật ký duyệt. Hãy huỷ phiếu";

    IntakeFixture f;
    EquipmentIntake intake;

    @BeforeEach
    void setUp() {
        f = new IntakeFixture();
        f.officerOfSchool1();
        intake = f.intake(VoucherStatus.DRAFT);
        f.stored(intake);
    }

    /** Phiếu đã có nhật ký duyệt (voucher_events). */
    private void hasHistory() {
        when(f.events.existsByResourceAndVoucherId(EquipmentIntakeService.RESOURCE, 311L)).thenReturn(true);
    }

    private void assertNotCancelled(VoucherStatus status, String message) {
        intake.setStatus(status);
        intake.setCode("NK-79000786-26-0002");
        assertThatThrownBy(() -> f.service.cancel(311L, "Lập nhầm nguồn"))
                .isInstanceOf(FieldValidationException.class).hasMessage(message);
        assertThat(intake.getStatus()).isEqualTo(status);
        verify(f.events, never()).save(any());
    }

    private void assertNotDeleted(String message) {
        assertThatThrownBy(() -> f.service.delete(311L)).isInstanceOf(FieldValidationException.class)
                .hasMessage(message);
        verify(f.repository, never()).remove(any());
    }

    @Test
    @DisplayName("UTCID01 - N: huỷ phiếu nháp có lý do → Đã huỷ, lý do đã trim, ghi nhật ký CANCEL")
    void utcid01() {
        EquipmentIntake result = f.service.cancel(311L, "  Lập nhầm nguồn  ");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.CANCELLED);
        assertThat(result.getCancelReason()).isEqualTo("Lập nhầm nguồn");
        VoucherEvent event = f.recordedEvents().get(0);
        assertThat(event.getAction()).isEqualTo(VoucherEvent.Action.CANCEL);
        assertThat(event.getFromStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(event.getToStatus()).isEqualTo(VoucherStatus.CANCELLED);
    }

    @Test
    @DisplayName("UTCID02 - B: huỷ không ghi lý do → Đã huỷ, cancelReason = null")
    void utcid02() {
        EquipmentIntake result = f.service.cancel(311L, null);
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.CANCELLED);
        assertThat(result.getCancelReason()).isNull();
        assertThat(f.recordedEvents().get(0).getNote()).isNull();
    }

    @Test
    @DisplayName("UTCID03 - N: phiếu đã từng trình (có số, bị trả lại) → huỷ được, giữ số")
    void utcid03() {
        intake.setCode("NK-79000786-26-0002");
        hasHistory();
        EquipmentIntake result = f.service.cancel(311L, "  Lập nhầm nguồn  ");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.CANCELLED);
        assertThat(result.getCode()).isEqualTo("NK-79000786-26-0002");
    }

    @Test
    @DisplayName("UTCID04 - A: huỷ phiếu đang Chờ duyệt → không huỷ được")
    void utcid04() {
        assertNotCancelled(VoucherStatus.PENDING, "Phiếu đang ở trạng thái \"chờ duyệt\", không huỷ được");
    }

    @Test
    @DisplayName("UTCID05 - A: huỷ phiếu đã Hoàn tất → không huỷ được")
    void utcid05() {
        assertNotCancelled(VoucherStatus.COMPLETED, "Phiếu đang ở trạng thái \"hoàn tất\", không huỷ được");
    }

    @Test
    @DisplayName("UTCID06 - A: huỷ phiếu ngoài phạm vi (phiếu của THPT An Lạc) → không tìm thấy")
    void utcid06() {
        f.stored(null);
        assertThatThrownBy(() -> f.service.cancel(311L, "Lập nhầm nguồn"))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(f.events);
    }
}
