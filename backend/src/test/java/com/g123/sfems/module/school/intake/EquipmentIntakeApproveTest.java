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
import com.g123.sfems.shared.exception.ResourceNotFoundException;
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
        f.leaderOfSchool(IntakeFixture.SCHOOL);
        intake = f.intake(VoucherStatus.PENDING);
        intake.setCode("NK-79000786-26-0002");
        intake.setIntakeDate(TODAY.minusDays(2));
        line = intake.getLines().get(0);
        line.setSerialList(List.of("X4YK620001", "X4YK620002", "X4YK620003", "X4YK620004", "X4YK620005"));
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
        assertThatThrownBy(() -> f.service.approve(311L, "Đồng ý ghi tăng"))
                .isInstanceOf(FieldValidationException.class).hasMessageStartingWith(message);
        verify(f.equipment, never()).generateFromIntakeLine(any());
        verify(f.equipment, never()).generateLotFromIntakeLine(any());
        verify(f.repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: hiệu trưởng Trần Ngọc Tú (THPT An Nghĩa) duyệt → Hoàn tất, ngày ghi tăng = hôm nay, sinh 5 thiết bị (MSG13)")
    void utcid01() {
        f.service.approve(311L, "Đồng ý ghi tăng");
        assertCompleted();
        assertThat(line.getGeneratedCount()).isEqualTo(5);
        verify(f.equipment, times(1)).generateFromIntakeLine(line);
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction)
                .containsExactly(VoucherEvent.Action.APPROVE, VoucherEvent.Action.COMPLETE);
        assertThat(approveEvent().getNote()).isEqualTo("Đồng ý ghi tăng");
        assertThat(f.publishedEvents()).anySatisfy(e -> assertThat(e).startsWith("VoucherApproved")
                .contains("code=NK-79000786-26-0002", "recipientId=289"));
    }

    @Test
    @DisplayName("UTCID02 - N: hoá chất theo số lượng chưa chọn nơi nhận → vào kho, sinh 1 hồ sơ lô")
    void utcid02() {
        EquipmentIntakeLine nacl = naclLine(true);
        f.service.approve(311L, "Đồng ý ghi tăng");
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
        f.service.approve(311L, "Đồng ý ghi tăng");
        assertCompleted();
        assertThat(line.getGeneratedCount()).isZero();
        assertThat(line.getRoom()).isSameAs(f.room101);
        verify(f.equipment, never()).generateFromIntakeLine(any());
    }

    @Test
    @DisplayName("UTCID04 - B: ý kiến chỉ khoảng trắng → Hoàn tất, nhật ký APPROVE ghi note = null")
    void utcid04() {
        f.service.approve(311L, "   ");
        assertCompleted();
        assertThat(approveEvent().getNote()).isNull();
        verify(f.equipment, times(1)).generateFromIntakeLine(line);
    }

    @Test
    @DisplayName("UTCID05 - N: không nhập ý kiến → Hoàn tất, nhật ký APPROVE ghi note = null")
    void utcid05() {
        f.service.approve(311L, null);
        assertCompleted();
        assertThat(approveEvent().getNote()).isNull();
    }

    @Test
    @DisplayName("UTCID06 - A: hiệu trưởng THPT An Lạc Lê Bảo Nam (79000805.hieutruong) duyệt phiếu của THPT An Nghĩa → không tìm thấy phiếu")
    void utcid06() {
        f.leaderOfSchool(IntakeFixture.OTHER_SCHOOL);
        f.stored(null);
        assertThatThrownBy(() -> f.service.approve(311L, "Đồng ý ghi tăng")).isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy phiếu ghi tăng (mã số 311) — có thể đã bị xoá hoặc nằm ngoài phạm vi dữ liệu của bạn");
        verify(f.repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID07 - A: phiếu còn Nháp (hiệu trưởng không thấy phiếu nháp) → không tìm thấy phiếu")
    void utcid07() {
        intake.setStatus(VoucherStatus.DRAFT);
        intake.setApprovalStep(null);
        f.stored(null);
        assertThatThrownBy(() -> f.service.approve(311L, "Đồng ý ghi tăng")).isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy phiếu ghi tăng (mã số 311) — có thể đã bị xoá hoặc nằm ngoài phạm vi dữ liệu của bạn");
        verify(f.repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID08 - A: bấm duyệt lần hai khi phiếu đã Hoàn tất → không sinh thêm thiết bị")
    void utcid08() {
        intake.setStatus(VoucherStatus.COMPLETED);
        intake.setApprovalStep(null);
        assertRefused("Phiếu đang ở trạng thái \"hoàn tất\", không duyệt được");
    }

    @Test
    @DisplayName("UTCID09 - B: phiếu khác vừa dùng số, bộ mã còn 4 cần 5 → MSG37")
    void utcid09() {
        String message = "Dòng 1 (Máy chiếu (hoặc Màn hình hiển thị)): cần 5 mã thiết bị nhưng bộ mã 79.D2.00.TB.xxxx.26 chỉ còn 4.";
        doThrow(new FieldValidationException("lines", message + " Số thứ tự trong mã có bốn chữ số…"))
                .when(f.equipment).checkCodeCapacity(intake);
        assertRefused(message);
    }

    @Test
    @DisplayName("UTCID10 - A: serial X4YK620001 vừa được thiết bị khác dùng → báo trùng serial")
    void utcid10() {
        when(f.equipment.serialHolder(eq(IntakeFixture.SCHOOL), eq("X4YK620001"), any())).thenReturn(Optional.of("79.D2.00.TB.0001.25"));
        assertRefused("Dòng 1 (Máy chiếu (hoặc Màn hình hiển thị)): số serial X4YK620001 đã có ở thiết bị 79.D2.00.TB.0001.25");
    }

    @Test
    @DisplayName("UTCID11 - A: đang có phiếu kiểm kê nháp \"Kiểm kê Phòng thiết bị giáo dục\" → số liệu đang khoá")
    void utcid11() {
        f.frozenBy(null, "Kiểm kê Phòng thiết bị giáo dục", "Phòng thiết bị giáo dục");
        assertRefused("Đang kiểm kê phòng Phòng thiết bị giáo dục theo phiếu kiểm kê nháp \"Kiểm kê Phòng thiết bị giáo dục\" — số liệu đang khoá.");
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.PENDING);
    }
}
