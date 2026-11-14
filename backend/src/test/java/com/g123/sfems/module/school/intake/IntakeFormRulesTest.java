package com.g123.sfems.module.school.intake;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.validation.FieldRule;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Luật của form lập phiếu ghi tăng chốt 13/11/2026 — phần không cần CSDL: số serial, chứng từ, hàng mua sắm. */
class IntakeFormRulesTest {

    private static EquipmentIntake intake(OriginRule origin, LocalDate intakeDate) {
        EquipmentIntake intake = new EquipmentIntake();
        if (origin != null) {
            OriginSource source = new OriginSource();
            source.setCode(origin.name());
            source.setName(origin.label());
            intake.setOriginSource(source);
        }
        intake.setIntakeDate(intakeDate);
        return intake;
    }

    private static EquipmentIntakeLine line(EquipmentIntake intake, int no, int received, String... serials) {
        EquipmentIntakeLine line = new EquipmentIntakeLine();
        line.setLineNo(no);
        line.setName("Máy chiếu " + no);
        line.setDocumentQuantity(received);
        line.setReceivedQuantity(received);
        line.setSerialList(EquipmentIntakeService.normalizeSerials(Arrays.asList(serials)));
        List<EquipmentIntakeLine> all = new ArrayList<>(intake.getLines());
        all.add(line);
        intake.replaceLines(all);
        return line;
    }

    @Test
    void serialsAreUpperCasedWithoutSpacesAndKeepTheirPosition() {
        // Serial khai theo TỪNG MÁY: ô trống giữ chỗ, để máy thứ 4 vẫn mang đúng số của nó.
        assertThat(EquipmentIntakeService.normalizeSerials(Arrays.asList(" sn 12 ab ", "", null, "x-1/2")))
                .containsExactly("SN12AB", "", "", "X-1/2");
        assertThat(FieldRule.SERIAL.violation("AB", 0, 3)).isEqualTo("tối thiểu 3 ký tự");
    }

    @Test
    void serialSlotsRoundTripWithGapsAndDropTrailingBlanks() {
        EquipmentIntakeLine line = new EquipmentIntakeLine();
        line.setSerialList(Arrays.asList("A01", "", "A03", "", ""));
        assertThat(line.serialSlots()).containsExactly("A01", "", "A03");
        assertThat(line.serialList()).containsExactly("A01", "A03");
        line.setSerialList(Arrays.asList("", ""));
        assertThat(line.serialSlots()).isEmpty();
    }

    @Test
    void unitRoomsKeepTheirPositionAndDropTrailingBlanks() {
        // Cái 2 về phòng 15, cái 1 và 3 theo phòng của dòng; phần trống ở cuối bỏ đi.
        EquipmentIntakeLine line = new EquipmentIntakeLine();
        line.setUnitRoomSlots(Arrays.asList(null, 15L, null, null));
        assertThat(line.unitRoomSlots()).containsExactly(null, 15L);
        line.setUnitRoomSlots(Arrays.asList(null, null));
        assertThat(line.unitRoomSlots()).isEmpty();
    }

    @Test
    void serialCountMustNotExceedReceivedQuantity() {
        EquipmentIntake intake = intake(OriginRule.MUA_SAM, LocalDate.of(2026, 11, 13));
        line(intake, 1, 2, "SN001", "SN002");
        assertThat(EquipmentIntakeService.serialProblem(intake.getLines())).isNull();
        line(intake, 2, 1, "SN010", "SN011");
        assertThat(EquipmentIntakeService.serialProblem(intake.getLines()))
                .contains("Dòng 2").contains("nhiều hơn số lượng nhận (1)");
    }

    @Test
    void serialMustBeUniqueAcrossTheVoucher() {
        EquipmentIntake intake = intake(OriginRule.MUA_SAM, LocalDate.of(2026, 11, 13));
        line(intake, 1, 3, "SN001", "sn 001");
        assertThat(EquipmentIntakeService.serialProblem(intake.getLines())).contains("nhập hai lần");

        EquipmentIntake other = intake(OriginRule.MUA_SAM, LocalDate.of(2026, 11, 13));
        line(other, 1, 2, "SN001");
        line(other, 2, 2, "SN001");
        assertThat(EquipmentIntakeService.serialProblem(other.getLines())).contains("trùng với dòng 1");
    }

    @Test
    void invoiceDateMustNotBeInTheFuture() {
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        EquipmentIntake intake = intake(OriginRule.MUA_SAM, today);
        intake.setDocumentDate(today.plusDays(1));
        assertThatThrownBy(() -> EquipmentIntakeService.checkDocuments(intake))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("không được sau hôm nay");
        intake.setDocumentDate(today);
        assertThatCode(() -> EquipmentIntakeService.checkDocuments(intake)).doesNotThrowAnyException();
    }

    @Test
    void invoiceNumberRuleAppliesOnlyToPurchases() {
        EquipmentIntake purchase = intake(OriginRule.MUA_SAM, LocalDate.of(2026, 11, 10));
        purchase.setDocumentNo("HĐ-0001");
        assertThatThrownBy(() -> EquipmentIntakeService.checkDocuments(purchase))
                .hasMessageContaining("Số hoá đơn");
        purchase.setDocumentNo("1C26TAA 0001234/2026-A.1");
        assertThatCode(() -> EquipmentIntakeService.checkDocuments(purchase)).doesNotThrowAnyException();
        purchase.setDocumentNo("1".repeat(31));
        assertThatThrownBy(() -> EquipmentIntakeService.checkDocuments(purchase)).hasMessageContaining("tối đa 30");

        EquipmentIntake allocated = intake(OriginRule.PHAN_BO, LocalDate.of(2026, 11, 10));
        allocated.setDocumentNo("1234/QĐ-SGDĐT");
        assertThatCode(() -> EquipmentIntakeService.checkDocuments(allocated)).doesNotThrowAnyException();
    }

    @Test
    void purchasePlanOriginMustComeFromAProposal() {
        EquipmentIntake manual = intake(OriginRule.MUA_SAM, LocalDate.of(2026, 11, 13));
        assertThatThrownBy(() -> EquipmentIntakeService.requirePlanLink(manual))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("chọn nguồn Trường tự mua sắm");
        manual.setSource("purchase_proposals", 7L, "DXMS-2026-0007");
        assertThatCode(() -> EquipmentIntakeService.requirePlanLink(manual)).doesNotThrowAnyException();

        // Trường tự mua sắm không đòi kế hoạch, nhưng vẫn là hàng mua.
        assertThatCode(() -> EquipmentIntakeService.requirePlanLink(intake(OriginRule.MUA_NGOAI_KH, LocalDate.of(2026, 11, 13))))
                .doesNotThrowAnyException();
        EquipmentIntake outside = intake(OriginRule.MUA_NGOAI_KH, LocalDate.of(2026, 11, 10));
        line(outside, 1, 1);
        assertThatThrownBy(() -> EquipmentIntakeService.requirePurchaseDocuments(outside)).hasMessageContaining("nhà cung cấp");
        // Nguồn khác không đòi kế hoạch.
        assertThatCode(() -> EquipmentIntakeService.requirePlanLink(intake(OriginRule.KHAC, LocalDate.of(2026, 11, 13))))
                .doesNotThrowAnyException();
    }

    @Test
    void purchaseNeedsSupplierInvoiceAndPositivePriceToSubmit() {
        EquipmentIntake intake = intake(OriginRule.MUA_SAM, LocalDate.of(2026, 11, 10));
        EquipmentIntakeLine first = line(intake, 1, 2);
        assertThatThrownBy(() -> EquipmentIntakeService.requirePurchaseDocuments(intake))
                .hasMessageContaining("nhà cung cấp");
        intake.setSupplier("Công ty CP Thiết bị Giáo dục Miền Nam");
        intake.setDocumentNo("0001234");
        intake.setDocumentDate(LocalDate.of(2026, 11, 5));
        assertThatThrownBy(() -> EquipmentIntakeService.requirePurchaseDocuments(intake))
                .hasMessageContaining("đơn giá lớn hơn 0");
        first.setUnitPrice(new BigDecimal("2850000"));
        assertThatCode(() -> EquipmentIntakeService.requirePurchaseDocuments(intake)).doesNotThrowAnyException();

        // Nguồn khác mua sắm: không đòi hoá đơn, đơn giá.
        EquipmentIntake donated = intake(OriginRule.TANG_TAI_TRO, LocalDate.of(2026, 11, 10));
        line(donated, 1, 1);
        assertThatCode(() -> EquipmentIntakeService.requirePurchaseDocuments(donated)).doesNotThrowAnyException();
    }
}
