package com.g123.sfems.module.school.intake;

import static com.g123.sfems.module.school.intake.IntakeFixture.TODAY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet approveIntake — PN-03 Duyệt và ghi tăng: {@link EquipmentIntakeService#approve}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class EquipmentIntakeApproveTest {

    static final String NOT_MY_TIER = "Phiếu đang chờ lãnh đạo trường duyệt — tài khoản của bạn không thuộc cấp này";

    IntakeFixture f;
    EquipmentIntake intake;
    EquipmentIntakeLine line;

    @BeforeEach
    void setUp() {
        f = new IntakeFixture();
        f.leaderOfSchool(1L);
        intake = f.intake(VoucherStatus.PENDING);
        intake.setCode("NK-2026-00001");
        intake.setIntakeDate(TODAY.minusDays(2));
        line = intake.getLines().get(0);
        line.setSerialList(List.of("SN001", "SN002", "SN003", "SN004", "SN005"));
        f.stored(intake);
    }

    private EquipmentIntakeLine naclLine(boolean withExpiry) {
        EquipmentIntakeLine nacl = f.line(intake, f.nacl, 500, 500, null, new BigDecimal("2000"));
        if (withExpiry) {
            nacl.setExpiryDate(TODAY.plusYears(2));
        }
        return f.onlyLine(intake, nacl);
    }

    private void assertCompleted() {
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.COMPLETED);
        assertThat(intake.getApprovalStep()).isNull();
        assertThat(intake.getIntakeDate()).isEqualTo(TODAY);
        verify(f.repository).persist(intake);
    }

    private VoucherEvent approveEvent() {
        return f.recordedEvents().stream().filter(e -> e.getAction() == VoucherEvent.Action.APPROVE).findFirst()
                .orElseThrow();
    }

    /** Lỗi khi duyệt: ném lỗi (giao dịch rollback), không sinh thiết bị, không lưu. */
    private void assertRefused(String message) {
        assertThatThrownBy(() -> f.service.approve(10L, "Đồng ý ghi tăng"))
                .isInstanceOf(FieldValidationException.class).hasMessageStartingWith(message);
        verify(f.equipment, never()).generateFromIntakeLine(any());
        verify(f.equipment, never()).generateLotFromIntakeLine(any());
        verify(f.repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: lãnh đạo trường 1 duyệt → Hoàn tất, ngày ghi tăng = hôm nay, sinh 5 thiết bị (MSG13)")
    void utcid01() {
        f.service.approve(10L, "Đồng ý ghi tăng");
        assertCompleted();
        assertThat(line.getGeneratedCount()).isEqualTo(5);
        verify(f.equipment, times(1)).generateFromIntakeLine(line);
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction)
                .containsExactly(VoucherEvent.Action.APPROVE, VoucherEvent.Action.COMPLETE);
        assertThat(approveEvent().getNote()).isEqualTo("Đồng ý ghi tăng");
        assertThat(f.publishedEvents()).anySatisfy(e -> assertThat(e).startsWith("VoucherApproved")
                .contains("code=NK-2026-00001", "recipientId=100"));
    }

    @Test
    @DisplayName("UTCID02 - N: hoá chất theo số lượng chưa chọn nơi nhận → vào kho, sinh 1 hồ sơ lô")
    void utcid02() {
        EquipmentIntakeLine nacl = naclLine(true);
        f.service.approve(10L, "Đồng ý ghi tăng");
        assertCompleted();
        assertThat(nacl.getRoom()).isSameAs(f.storeroom);
        assertThat(nacl.getGeneratedCount()).isEqualTo(500);
        verify(f.equipment, times(1)).generateLotFromIntakeLine(nacl);
        verify(f.equipment, never()).generateFromIntakeLine(any());
    }

    @Test
    @DisplayName("UTCID03 - B: dòng thực nhận 0 → Hoàn tất, không sinh thiết bị")
    void utcid03() {
        line.setReceivedQuantity(0);
        line.setVarianceReason("Hàng chưa về");
        line.setSerialList(List.of());
        f.service.approve(10L, "Đồng ý ghi tăng");
        assertCompleted();
        assertThat(line.getGeneratedCount()).isZero();
        assertThat(line.getRoom()).isSameAs(f.room101);
        verify(f.equipment, never()).generateFromIntakeLine(any());
    }

    @Test
    @DisplayName("UTCID04 - B: ý kiến chỉ khoảng trắng → Hoàn tất, nhật ký APPROVE ghi note = null")
    void utcid04() {
        f.service.approve(10L, "   ");
        assertCompleted();
        assertThat(approveEvent().getNote()).isNull();
        verify(f.equipment, times(1)).generateFromIntakeLine(line);
    }

    @Test
    @DisplayName("UTCID05 - N: không nhập ý kiến → Hoàn tất, nhật ký APPROVE ghi note = null")
    void utcid05() {
        f.service.approve(10L, null);
        assertCompleted();
        assertThat(approveEvent().getNote()).isNull();
    }

    @Test
    @DisplayName("UTCID06 - A: lãnh đạo trường 2 duyệt phiếu trường 1 → MSG10")
    void utcid06() {
        f.leaderOfSchool(2L);
        assertRefused(NOT_MY_TIER);
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.PENDING);
    }

    @Test
    @DisplayName("UTCID07 - A: quản trị viên không thuộc cấp duyệt → MSG10")
    void utcid07() {
        f.admin();
        assertRefused(NOT_MY_TIER);
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.PENDING);
    }

    @Test
    @DisplayName("UTCID08 - A: phiếu còn Nháp → không duyệt được")
    void utcid08() {
        intake.setStatus(VoucherStatus.DRAFT);
        intake.setApprovalStep(null);
        assertRefused("Phiếu đang ở trạng thái \"nháp\", không duyệt được");
    }

    @Test
    @DisplayName("UTCID09 - A: bấm duyệt lần hai khi phiếu đã Hoàn tất → không sinh thêm thiết bị")
    void utcid09() {
        intake.setStatus(VoucherStatus.COMPLETED);
        intake.setApprovalStep(null);
        assertRefused("Phiếu đang ở trạng thái \"hoàn tất\", không duyệt được");
    }

    @Test
    @DisplayName("UTCID10 - A: hoá chất chưa có hạn sử dụng → báo nhập hạn sử dụng")
    void utcid10() {
        naclLine(false);
        assertRefused("Dòng 1 (NaCl): nhập hạn sử dụng — hoá chất bắt buộc có hạn sử dụng.");
    }

    @Test
    @DisplayName("UTCID11 - B: phiếu khác vừa dùng số, bộ mã còn 4 cần 5 → MSG37")
    void utcid11() {
        String message = "Dòng 1 (Máy chiếu): cần 5 mã thiết bị nhưng bộ mã 79.JP.00.TB.26 chỉ còn 4.";
        doThrow(new FieldValidationException("lines", message + " Số thứ tự trong mã có ba chữ số…"))
                .when(f.equipment).checkCodeCapacity(intake);
        assertRefused(message);
    }

    @Test
    @DisplayName("UTCID12 - A: serial SN001 vừa được thiết bị khác dùng → báo trùng serial")
    void utcid12() {
        when(f.equipment.serialHolder(eq(1L), eq("SN001"), any())).thenReturn(Optional.of("79.JP.00.TB.26.004"));
        assertRefused("Dòng 1 (Máy chiếu): số serial SN001 đã có ở thiết bị 79.JP.00.TB.26.004");
    }

    @Test
    @DisplayName("UTCID13 - A: đang kiểm kê phòng Phòng Tin 1 theo KK-2026-00002 → số liệu đang khoá")
    void utcid13() {
        f.frozenBy("KK-2026-00002", "Phòng Tin 1");
        assertRefused("Đang kiểm kê phòng Phòng Tin 1 theo phiếu kiểm kê KK-2026-00002 — số liệu đang khoá.");
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.PENDING);
    }
}
