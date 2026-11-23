package com.g123.sfems.module.school.intake;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet submitIntake — PN-02 Trình phiếu ghi tăng: {@link EquipmentIntakeService#submit}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class EquipmentIntakeSubmitTest {

    IntakeFixture f;
    EquipmentIntake intake;

    @BeforeEach
    void setUp() {
        f = new IntakeFixture();
        f.officerOfSchool1();
        intake = f.intake(VoucherStatus.DRAFT);
        f.stored(intake);
    }

    private EquipmentIntakeLine line() {
        return intake.getLines().get(0);
    }

    /** Lỗi khi trình: phiếu vẫn Nháp, không cấp số, không ghi nhật ký. */
    private void assertRefused(String message) {
        assertThatThrownBy(() -> f.service.submit(10L)).isInstanceOf(FieldValidationException.class)
                .hasMessage(message);
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(intake.getCode()).isNull();
        verifyNoInteractions(f.numbers, f.events);
        verify(f.repository, never()).persist(any());
    }

    private void assertAwaitingLeader() {
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.SUBMIT);
        assertThat(f.publishedEvents()).singleElement().asString()
                .startsWith("VoucherAwaiting").contains("step=SCHOOL", "schoolId=1");
    }

    @Test
    @DisplayName("UTCID01 - N: phiếu đủ dữ liệu → Chờ duyệt, cấp số NK-2026-00001, báo lãnh đạo trường (MSG08)")
    void utcid01() {
        EquipmentIntake result = f.service.submit(10L);
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.PENDING);
        assertThat(result.getCode()).isEqualTo("NK-2026-00001");
        assertThat(result.getApprovalStep()).isEqualTo(ApprovalStep.SCHOOL);
        assertThat(result.getSubmittedAt()).isNotNull();
        assertAwaitingLeader();
    }

    @Test
    @DisplayName("UTCID02 - N: phiếu bị trả lại đã có số → trình lại giữ số NK-2026-00003")
    void utcid02() {
        intake.setCode("NK-2026-00003");
        EquipmentIntake result = f.service.submit(10L);
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.PENDING);
        assertThat(result.getCode()).isEqualTo("NK-2026-00003");
        verifyNoInteractions(f.numbers);
        assertAwaitingLeader();
    }

    @Test
    @DisplayName("UTCID03 - N: luồng duyệt rỗng → Hoàn tất ngay, sinh 5 thiết bị")
    void utcid03() {
        when(f.approvalFlows.chainOf(any())).thenReturn(List.of());
        EquipmentIntake result = f.service.submit(10L);
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.COMPLETED);
        assertThat(line().getGeneratedCount()).isEqualTo(5);
        verify(f.equipment, times(1)).generateFromIntakeLine(line());
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction)
                .containsExactly(VoucherEvent.Action.SUBMIT, VoucherEvent.Action.COMPLETE);
    }

    @Test
    @DisplayName("UTCID04 - N: nguồn Kiểm kê thừa, không hoá đơn, không kinh phí → Chờ duyệt, kinh phí \"Chưa xác định nguồn\"")
    void utcid04() {
        intake.setOriginSource(f.origin(OriginRule.KIEM_KE_THUA));
        intake.setSupplier(null);
        intake.setDocumentNo(null);
        intake.setDocumentDate(null);
        intake.setFundingSource(null);
        line().setUnitPrice(null);
        EquipmentIntake result = f.service.submit(10L);
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.PENDING);
        assertThat(line().getFundingSource()).isEqualTo(FundingSource.UNDETERMINED);
        assertAwaitingLeader();
    }

    @Test
    @DisplayName("UTCID05 - A: phiếu không có dòng → MSG33")
    void utcid05() {
        intake.replaceLines(new ArrayList<>());
        assertRefused("Phiếu chưa có dòng nào để ghi tăng");
    }

    @Test
    @DisplayName("UTCID06 - A: phiếu đang Chờ duyệt → không trình lại được")
    void utcid06() {
        intake.setStatus(VoucherStatus.PENDING);
        intake.setCode("NK-2026-00003");
        assertThatThrownBy(() -> f.service.submit(10L)).isInstanceOf(FieldValidationException.class)
                .hasMessage("Phiếu đang ở trạng thái \"chờ duyệt\", không trình được");
        assertThat(intake.getCode()).isEqualTo("NK-2026-00003");
        verifyNoInteractions(f.numbers, f.events);
    }

    @Test
    @DisplayName("UTCID07 - A: nguồn Kế hoạch mua sắm nhưng không lập từ đề xuất → báo chọn kế hoạch")
    void utcid07() {
        intake.setOriginSource(f.origin(OriginRule.MUA_SAM));
        assertRefused("Nguồn Kế hoạch mua sắm: chọn kế hoạch mua sắm. Hàng tự mua ngoài kế hoạch thì chọn nguồn "
                + "Trường tự mua sắm");
    }

    @Test
    @DisplayName("UTCID08 - A: nguồn Khác chưa ghi rõ → MSG34")
    void utcid08() {
        intake.setOriginSource(f.origin(OriginRule.KHAC));
        intake.setSupplier(null);
        intake.setDocumentNo(null);
        intake.setDocumentDate(null);
        assertRefused("Nguồn hình thành \"Khác\": ghi rõ là nguồn gì");
    }

    @Test
    @DisplayName("UTCID09 - A: hàng mua thiếu nhà cung cấp → MSG51")
    void utcid09() {
        intake.setSupplier(null);
        assertRefused("Hàng mua sắm: nhập nhà cung cấp");
    }

    @Test
    @DisplayName("UTCID10 - A: hàng mua thiếu số hoá đơn → MSG51")
    void utcid10() {
        intake.setDocumentNo(null);
        assertRefused("Hàng mua sắm: nhập số hoá đơn");
    }

    @Test
    @DisplayName("UTCID11 - A: đơn giá trống → MSG35")
    void utcid11() {
        line().setUnitPrice(null);
        assertRefused("Dòng 1 (Máy chiếu): hàng mua sắm phải có đơn giá lớn hơn 0");
    }

    @Test
    @DisplayName("UTCID12 - B: đơn giá 0 → MSG35")
    void utcid12() {
        line().setUnitPrice(BigDecimal.ZERO);
        assertRefused("Dòng 1 (Máy chiếu): hàng mua sắm phải có đơn giá lớn hơn 0");
    }

    @Test
    @DisplayName("UTCID13 - A: chưa chọn nguồn kinh phí → MSG35, liệt kê nguồn chọn được")
    void utcid13() {
        intake.setFundingSource(null);
        assertRefused("Dòng 1 (Máy chiếu): chọn nguồn kinh phí. Với nguồn hình thành \"Trường tự mua sắm\" chọn được: "
                + "Ngân sách, Học phí, Nguồn thu sự nghiệp, Quỹ phát triển sự nghiệp, Tài trợ, Nguồn khác");
    }

    @Test
    @DisplayName("UTCID14 - A: chưa đính kèm tệp → MSG51")
    void utcid14() {
        f.attachments = 0;
        assertRefused("Đính kèm ít nhất một tệp — hoá đơn hoặc biên bản giao nhận — rồi trình");
    }

    @Test
    @DisplayName("UTCID15 - A: trường chưa có mã EMIS → MSG36")
    void utcid15() {
        String message = "Dòng 1 (Máy chiếu): chưa sinh được mã thiết bị — trường chưa có mã EMIS hoặc môn của nhóm "
                + "thiết bị chưa có mã dạy học";
        doThrow(new FieldValidationException("lines", message)).when(f.equipment).checkCodeCapacity(intake);
        assertRefused(message);
    }

    @Test
    @DisplayName("UTCID16 - B: bộ mã còn 4 số, cần 5 → MSG37")
    void utcid16() {
        String message = "Dòng 1 (Máy chiếu): cần 5 mã thiết bị nhưng bộ mã 79.JP.00.TB.26 chỉ còn 4. Số thứ tự trong "
                + "mã có ba chữ số nên mỗi bộ chứa tối đa 999 thiết bị một năm. Tách bớt số lượng sang phiếu khác, "
                + "hoặc khai mã dạy học của môn cho nhóm thiết bị để nhóm có bộ đếm riêng.";
        doThrow(new FieldValidationException("lines", message)).when(f.equipment).checkCodeCapacity(intake);
        assertRefused(message);
    }

    @Test
    @DisplayName("UTCID17 - A: đang kiểm kê cả trường theo KK-2026-00001 → số liệu đang khoá")
    void utcid17() {
        f.frozenBy("KK-2026-00001", null);
        assertThatThrownBy(() -> f.service.submit(10L)).isInstanceOf(FieldValidationException.class)
                .hasMessageStartingWith("Đang kiểm kê cả trường theo phiếu kiểm kê KK-2026-00001 — số liệu đang khoá.");
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        verifyNoInteractions(f.numbers, f.events);
    }
}
