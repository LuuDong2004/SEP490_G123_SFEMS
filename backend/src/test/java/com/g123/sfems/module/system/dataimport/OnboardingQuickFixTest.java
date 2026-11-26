package com.g123.sfems.module.system.dataimport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OnboardingQuickFixTest {

    @Test
    void normalizeCodeDropsAccentsSpacesAndBrackets() {
        assertThat(OnboardingQuickFix.normalizeCode("Khu E (tầng 1)")).isEqualTo("Khu-E-tang-1");
        assertThat(OnboardingQuickFix.normalizeCode(" A.101 ")).isEqualTo("A.101");
        assertThat(OnboardingQuickFix.normalizeCode("Phòng đa năng")).isEqualTo("Phong-da-nang");
    }

    @Test
    void buildingMatchesByInitialsOrSpelling() {
        assertThat(OnboardingQuickFix.sameBuilding("KA", "Khu A")).isTrue();
        assertThat(OnboardingQuickFix.sameBuilding("Khu-A", "Khu A")).isTrue();
        assertThat(OnboardingQuickFix.sameBuilding("KB", "Khu A")).isFalse();
        assertThat(OnboardingQuickFix.sameBuilding("A", "Khu A")).isFalse();
    }

    @Test
    void conditionWordsMapToListedValues() {
        assertThat(OnboardingQuickFix.facilityCondition("Bị Thấm Dột")).isEqualTo("Cần sửa chữa");
        assertThat(OnboardingQuickFix.facilityCondition("Bị Thấm Dột Nặng")).isEqualTo("Xuống cấp");
        assertThat(OnboardingQuickFix.facilityCondition("Tốt (Phòng tạm vách ngăn)")).isEqualTo("Tốt");
        assertThat(OnboardingQuickFix.facilityCondition("Ai biết")).isNull();
        assertThat(OnboardingQuickFix.equipmentCondition("Hư nặng không sử dụng được")).isEqualTo("Kém");
    }

    @Test
    void chemicalUnitByName() {
        assertThat(OnboardingQuickFix.chemicalUnit("Natri clorua NaCl")).isEqualTo("Gam");
        assertThat(OnboardingQuickFix.chemicalUnit("Kali kim loại K")).isEqualTo("Gam");
        assertThat(OnboardingQuickFix.chemicalUnit("Nước cất H2O")).isEqualTo("Mililít");
        assertThat(OnboardingQuickFix.chemicalUnit("Dung dịch benedic +CuSO4")).isEqualTo("Mililít");
        assertThat(OnboardingQuickFix.chemicalUnit("Thuốc thử felinh")).isEqualTo("Mililít");
        assertThat(OnboardingQuickFix.chemicalUnit("Giấy đo pH")).isNull();
    }

    @Test
    void staffPositionFromShortForms() {
        assertThat(OnboardingQuickFix.staffPosition("PHT")).isEqualTo("Phó hiệu trưởng");
        assertThat(OnboardingQuickFix.staffPosition("Hiệu phó")).isEqualTo("Phó hiệu trưởng");
        assertThat(OnboardingQuickFix.staffPosition("HT")).isEqualTo("Hiệu trưởng");
        assertThat(OnboardingQuickFix.staffPosition("TT chuyên môn")).isEqualTo("Tổ trưởng chuyên môn");
        assertThat(OnboardingQuickFix.staffPosition("Phụ trách thiết bị")).isEqualTo("Cán bộ thiết bị");
        assertThat(OnboardingQuickFix.staffPosition("GVBM")).isEqualTo("Giáo viên");
        assertThat(OnboardingQuickFix.staffPosition("Bảo vệ")).isEqualTo("Nhân viên");
        assertThat(OnboardingQuickFix.staffPosition("Ai biết")).isNull();
    }

    @Test
    void emailIsCleanedOrLeftAlone() {
        assertThat(OnboardingQuickFix.emailFix(" Nguyen.An @Gmail,com ")).isEqualTo("nguyen.an@gmail.com");
        assertThat(OnboardingQuickFix.emailFix("trần.bình@thpt.edu.vn")).isEqualTo("tran.binh@thpt.edu.vn");
        assertThat(OnboardingQuickFix.emailFix("khong-phai-email")).isNull();
    }

    @Test
    void recorderIsNotOil() {
        assertThat(OnboardingValidator.chemicalName("Đầu ghi hình Kivision")).isFalse();
        assertThat(OnboardingValidator.chemicalName("Đâu ghi AHD HYBRID 16 kênh")).isFalse();
        assertThat(OnboardingValidator.chemicalName("Dầu hoả")).isTrue();
    }
}
