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

/** Sheet cancelIntake — PN-01 Huỷ / xoá phiếu ghi tăng: {@link EquipmentIntakeService#cancel}, {@code delete}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class EquipmentIntakeCancelDeleteTest {

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
        when(f.events.existsByResourceAndVoucherId(EquipmentIntakeService.RESOURCE, 10L)).thenReturn(true);
    }

    private void assertNotCancelled(VoucherStatus status, String message) {
        intake.setStatus(status);
        intake.setCode("NK-2026-00001");
        assertThatThrownBy(() -> f.service.cancel(10L, "Lập nhầm nguồn"))
                .isInstanceOf(FieldValidationException.class).hasMessage(message);
        assertThat(intake.getStatus()).isEqualTo(status);
        verify(f.events, never()).save(any());
    }

    private void assertNotDeleted(String message) {
        assertThatThrownBy(() -> f.service.delete(10L)).isInstanceOf(FieldValidationException.class)
                .hasMessage(message);
        verify(f.repository, never()).remove(any());
    }

    @Test
    @DisplayName("UTCID01 - N: huỷ phiếu nháp có lý do → Đã huỷ, lý do đã trim, ghi nhật ký CANCEL")
    void utcid01() {
        EquipmentIntake result = f.service.cancel(10L, "  Lập nhầm nguồn  ");
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
        EquipmentIntake result = f.service.cancel(10L, null);
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.CANCELLED);
        assertThat(result.getCancelReason()).isNull();
        assertThat(f.recordedEvents().get(0).getNote()).isNull();
    }

    @Test
    @DisplayName("UTCID03 - N: phiếu đã từng trình (có số, bị trả lại) → huỷ được, giữ số")
    void utcid03() {
        intake.setCode("NK-2026-00001");
        hasHistory();
        EquipmentIntake result = f.service.cancel(10L, "  Lập nhầm nguồn  ");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.CANCELLED);
        assertThat(result.getCode()).isEqualTo("NK-2026-00001");
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
    @DisplayName("UTCID06 - A: huỷ phiếu ngoài phạm vi (trường 2) → không tìm thấy")
    void utcid06() {
        f.stored(null);
        assertThatThrownBy(() -> f.service.cancel(10L, "Lập nhầm nguồn"))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(f.events);
    }

    @Test
    @DisplayName("UTCID07 - N: xoá phiếu nháp chưa từng trình → xoá hẳn, trả về phiếu kèm dòng")
    void utcid07() {
        EquipmentIntake result = f.service.delete(10L);
        assertThat(result).isSameAs(intake);
        assertThat(result.getLines()).hasSize(1);
        verify(f.repository).remove(intake);
    }

    @Test
    @DisplayName("UTCID08 - A: xoá phiếu nháp đã có số (từng trình) → báo hãy huỷ phiếu")
    void utcid08() {
        intake.setCode("NK-2026-00001");
        hasHistory();
        assertNotDeleted(ALREADY_SUBMITTED);
    }

    @Test
    @DisplayName("UTCID09 - A: xoá phiếu đang Chờ duyệt → chỉ xoá được nháp hoặc đã huỷ")
    void utcid09() {
        intake.setStatus(VoucherStatus.PENDING);
        intake.setCode("NK-2026-00001");
        assertNotDeleted("Chỉ xoá được phiếu nháp hoặc phiếu đã huỷ");
    }

    @Test
    @DisplayName("UTCID10 - B: xoá phiếu đã huỷ chưa có số nhưng có nhật ký CANCEL → không xoá được")
    void utcid10() {
        intake.setStatus(VoucherStatus.CANCELLED);
        hasHistory();
        assertNotDeleted(ALREADY_SUBMITTED);
    }

    @Test
    @DisplayName("UTCID11 - A: xoá phiếu ngoài phạm vi (trường 2) → không tìm thấy")
    void utcid11() {
        f.stored(null);
        assertThatThrownBy(() -> f.service.delete(10L)).isInstanceOf(ResourceNotFoundException.class);
        verify(f.repository, never()).remove(any());
    }
}
