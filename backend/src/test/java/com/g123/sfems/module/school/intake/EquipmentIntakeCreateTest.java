package com.g123.sfems.module.school.intake;

import static com.g123.sfems.module.school.intake.IntakeFixture.TODAY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.test.util.ReflectionTestUtils;

/** Sheet createIntake — PN-01 Lập phiếu ghi tăng (lưu nháp): {@link EquipmentIntakeService#create}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class EquipmentIntakeCreateTest {

    IntakeFixture f;

    // Giá trị mặc định của các case (UTCID01) — từng case đổi đúng một hai ô.
    IdRef school;
    OriginRule origin;
    LocalDate documentDate;
    String documentNo;
    IdRef acquisitionMethod;
    int documentQty;
    int receivedQty;
    String varianceReason;
    Long room;
    FundingSource funding;
    List<String> serials;

    @BeforeEach
    void setUp() {
        f = new IntakeFixture();
        f.officerOfSchool1();
        school = new IdRef(1L);
        origin = OriginRule.MUA_NGOAI_KH;
        documentDate = LocalDate.of(2026, 11, 20).isAfter(TODAY) ? TODAY : LocalDate.of(2026, 11, 20);
        documentNo = "HD-0012/2026";
        acquisitionMethod = null;
        documentQty = 5;
        receivedQty = 5;
        varianceReason = null;
        room = 101L;
        funding = FundingSource.STATE_BUDGET;
        serials = null;
    }

    private EquipmentIntake create() {
        EquipmentIntakeLineInput line = new EquipmentIntakeLineInput(new IdRef(1L), null, PhysicalDigitalType.PHYSICAL,
                null, documentQty, receivedQty, varianceReason, new BigDecimal("12000000"),
                room == null ? null : new IdRef(room), null, null, null, null, funding, null, null, null, null, null,
                null, null, null, null, null, serials, null, null, null, null, null, null, null);
        EquipmentIntakeRequest request = new EquipmentIntakeRequest(school, documentNo, documentDate, "Công ty ABC",
                null, origin == null ? null : f.originRef(origin), null, null, acquisitionMethod, null, null,
                List.of(line), null, null);
        return f.service.create(request);
    }

    private void assertRefused(String message) {
        assertThatThrownBy(this::create).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verify(f.repository, never()).persist(any());
    }

    private EquipmentIntake assertSavedDraft() {
        EquipmentIntake saved = create();
        assertThat(saved.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(saved.getCode()).isNull();
        verify(f.repository).persist(saved);
        return saved;
    }

    @Test
    @DisplayName("UTCID01 - N: dữ liệu hợp lệ → phiếu Nháp, chưa có số, ngày ghi tăng hôm nay, năm học theo ngày")
    void utcid01() {
        EquipmentIntake saved = assertSavedDraft();
        assertThat(saved.getIntakeDate()).isEqualTo(TODAY);
        assertThat(saved.getSchoolYear()).isSameAs(f.schoolYear);
        assertThat(saved.getLines()).hasSize(1);
        assertThat(saved.getLines().get(0).getLineNo()).isEqualTo(1);
        assertThat(saved.getLines().get(0).getName()).isEqualTo("Máy chiếu");
    }

    @Test
    @DisplayName("UTCID02 - A: chưa chọn nguồn hình thành → \"Vui lòng chọn nguồn hình thành\"")
    void utcid02() {
        origin = null;
        assertRefused("Vui lòng chọn nguồn hình thành");
    }

    @Test
    @DisplayName("UTCID03 - A: tài khoản Sở không truyền trường → \"Chọn trường\"")
    void utcid03() {
        f.soAccount();
        school = null;
        assertRefused("Chọn trường");
    }

    @Test
    @DisplayName("UTCID04 - A: thực nhận 4 khác chứng từ 5, không ghi lý do → MSG31")
    void utcid04() {
        receivedQty = 4;
        assertRefused("Dòng 1 (Máy chiếu): số thực nhận khác số trên chứng từ, phải ghi lý do chênh lệch");
    }

    @Test
    @DisplayName("UTCID05 - N: thực nhận 4 / 5 có lý do → lưu Nháp, lý do đã trim")
    void utcid05() {
        receivedQty = 4;
        varianceReason = "  NCC giao thiếu 1 máy  ";
        EquipmentIntake saved = assertSavedDraft();
        assertThat(saved.getLines().get(0).getVarianceReason()).isEqualTo("NCC giao thiếu 1 máy");
    }

    @Test
    @DisplayName("UTCID06 - B: thực nhận 0 / 5 có lý do → lưu Nháp, dòng nhận 0")
    void utcid06() {
        receivedQty = 0;
        varianceReason = "Hàng chưa về";
        EquipmentIntake saved = assertSavedDraft();
        assertThat(saved.getLines().get(0).getReceivedQuantity()).isZero();
    }

    @Test
    @DisplayName("UTCID07 - A: phòng nhận thuộc trường 2 → MSG32")
    void utcid07() {
        room = 201L;
        assertRefused("Dòng 1 (Máy chiếu): phòng nhận không thuộc trường của phiếu");
    }

    @Test
    @DisplayName("UTCID08 - A: phòng nhận đã ngừng sử dụng → báo chọn phòng khác")
    void utcid08() {
        room = 102L;
        assertRefused("Dòng 1 (Máy chiếu): phòng Phòng Tin 2 đã ngừng sử dụng — chọn phòng khác");
    }

    @Test
    @DisplayName("UTCID09 - N: chưa chọn nơi nhận → lưu Nháp, room = null (vào kho khi duyệt)")
    void utcid09() {
        room = null;
        EquipmentIntake saved = assertSavedDraft();
        assertThat(saved.getLines().get(0).getRoom()).isNull();
    }

    @Test
    @DisplayName("UTCID10 - A: nguồn Được tặng + kinh phí Ngân sách → báo không đi với nguồn hình thành")
    void utcid10() {
        origin = OriginRule.TANG_TAI_TRO;
        assertRefused("Dòng 1 (Máy chiếu): nguồn kinh phí \"Ngân sách\" không đi với nguồn hình thành "
                + "\"Được tặng, tài trợ\". Chọn một trong: Tài trợ");
    }

    @Test
    @DisplayName("UTCID11 - N: nguồn Được tặng + kinh phí Tài trợ → lưu Nháp, gỡ hình thức mua sắm")
    void utcid11() {
        origin = OriginRule.TANG_TAI_TRO;
        funding = FundingSource.SPONSORSHIP;
        AcquisitionMethod method = new AcquisitionMethod();
        ReflectionTestUtils.setField(method, "id", 1L);
        method.setCode("CHAO_HANG");
        method.setName("Chào hàng cạnh tranh");
        when(f.acquisitionMethods.get(1L)).thenReturn(method);
        acquisitionMethod = new IdRef(1L);
        EquipmentIntake saved = assertSavedDraft();
        assertThat(saved.getAcquisitionMethod()).isNull();
    }

    @Test
    @DisplayName("UTCID12 - A: ngày hoá đơn sau hôm nay → \"Ngày hoá đơn không được sau hôm nay\"")
    void utcid12() {
        documentDate = TODAY.plusDays(1);
        assertRefused("Ngày hoá đơn không được sau hôm nay");
    }

    @Test
    @DisplayName("UTCID13 - B: ngày hoá đơn đúng hôm nay → lưu Nháp")
    void utcid13() {
        documentDate = TODAY;
        assertThat(assertSavedDraft().getDocumentDate()).isEqualTo(TODAY);
    }

    @Test
    @DisplayName("UTCID14 - A: số hoá đơn có chữ có dấu → báo luật số hoá đơn")
    void utcid14() {
        documentNo = "HĐ số 12";
        assertRefused("Số hoá đơn chỉ gồm chữ không dấu, số, dấu / - . và khoảng trắng");
    }

    @Test
    @DisplayName("UTCID15 - B: số hoá đơn đúng 30 ký tự → lưu Nháp")
    void utcid15() {
        documentNo = "HD-2026-0000000000000000000001";
        assertThat(documentNo).hasSize(30);
        assertThat(assertSavedDraft().getDocumentNo()).isEqualTo(documentNo);
    }

    @Test
    @DisplayName("UTCID16 - N: serial \" sn001 \", \"SN002\" → chuẩn hoá thành SN001, SN002")
    void utcid16() {
        serials = List.of(" sn001 ", "SN002");
        EquipmentIntakeLine line = assertSavedDraft().getLines().get(0);
        assertThat(line.serialList()).containsExactly("SN001", "SN002");
    }

    @Test
    @DisplayName("UTCID17 - A: serial SN001 nhập hai lần → báo trùng trong dòng")
    void utcid17() {
        serials = List.of("SN001", "sn001");
        assertRefused("Dòng 1 (Máy chiếu): số serial SN001 nhập hai lần");
    }

    @Test
    @DisplayName("UTCID18 - B: 6 serial cho 5 máy → báo nhiều hơn số lượng nhận")
    void utcid18() {
        serials = List.of("SN001", "SN002", "SN003", "SN004", "SN005", "SN006");
        assertRefused("Dòng 1 (Máy chiếu): có số serial cho máy thứ 6, nhiều hơn số lượng nhận (5)");
    }

    @Test
    @DisplayName("UTCID19 - A: serial SN001 đã có ở thiết bị khác của trường → báo trùng")
    void utcid19() {
        serials = List.of("SN001", "SN002");
        when(f.equipment.serialHolder(eq(1L), eq("SN001"), any())).thenReturn(Optional.of("79.JP.00.TB.26.004"));
        assertRefused("Dòng 1 (Máy chiếu): số serial SN001 đã có ở thiết bị 79.JP.00.TB.26.004");
    }
}
