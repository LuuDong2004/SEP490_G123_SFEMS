package com.g123.sfems.module.system.dataimport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Hai phép so của việc ghép dữ liệu đầu vào với danh mục: chuẩn hoá tên (bỏ dấu, i/y cuối âm tiết) và nhận ra
 * công thức hoá học trong tên — tên trên sổ cũ của trường ("Natri hiđroxit NaOH") và tên trong danh mục
 * ("Sodium hydroxide (NaOH)") chỉ gặp nhau ở công thức.
 */
class OnboardingValidatorTest {

    @Test
    void normFoldsAccentsCaseAndIYEndings() {
        assertThat(OnboardingValidator.norm("Bộ dụng cụ vẽ kỹ thuật")).isEqualTo(OnboardingValidator.norm("Bộ dụng cụ vẽ kĩ thuật"));
        assertThat(OnboardingValidator.norm("Vật lý")).isEqualTo(OnboardingValidator.norm("Vật lí"));
        assertThat(OnboardingValidator.norm("Mĩ thuật")).isEqualTo(OnboardingValidator.norm("Mỹ thuật"));
        assertThat(OnboardingValidator.norm("Hoá học")).isEqualTo(OnboardingValidator.norm("Hóa học"));
        // "thuỷ" không phải i/y sau phụ âm — không bị đổi thành "thui".
        assertThat(OnboardingValidator.norm("Lọ thuỷ tinh")).isEqualTo("LO_THUY_TINH");
    }

    @Test
    void formulasFindRealCompoundsOnly() {
        assertThat(OnboardingValidator.formulas("Natri hiđroxit NaOH")).containsExactly("NaOH");
        assertThat(OnboardingValidator.formulas("Sodium hydroxide (NaOH)")).containsExactly("NaOH");
        assertThat(OnboardingValidator.formulas("Axit Sunfuric 36% H2SO4")).containsExactly("H2SO4");
        assertThat(OnboardingValidator.formulas("Canxi hiđroxit Ca(OH)2")).containsExactly("Ca(OH)2");
        assertThat(OnboardingValidator.formulas("Canxi clorua CaCl2.6H2O")).containsExactly("CaCl2.6H2O");
        assertThat(OnboardingValidator.formulas("Kali iotua KI")).containsExactly("KI");
    }

    @Test
    void formulasIgnoreAcronymsAndModelNames() {
        assertThat(OnboardingValidator.formulas("Mô hình súng AK-47, CKC, B40, B41 cắt bổ")).isEmpty();
        assertThat(OnboardingValidator.formulas("Bàn ghế HS")).isEmpty();
        assertThat(OnboardingValidator.formulas("Tranh GV dùng")).isEmpty();
        assertThat(OnboardingValidator.formulas("Giấy đo pH")).isEmpty();
    }

    @Test
    void serialKeyTrimsAndIgnoresCase() {
        assertThat(OnboardingValidator.serialKey("  ab-12C ")).isEqualTo(OnboardingValidator.serialKey("AB-12c"));
        assertThat(OnboardingValidator.serialKey("   ")).isNull();
        assertThat(OnboardingValidator.serialKey(null)).isNull();
    }
}
