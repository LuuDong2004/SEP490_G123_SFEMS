package com.g123.sfems.shared.validation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.PasswordPolicy;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Giá trị hợp lệ, giá trị biên, giá trị sai cho từng kiểu chuẩn (HSDT TL4.1.12). */
class FieldRuleTest {

    @Test
    void minimumLengthCountsTrimmedTextAndSkipsEmpty() {
        assertThat(FieldRule.NAME.violation("A", 200, 2)).isEqualTo("tối thiểu 2 ký tự");
        assertThat(FieldRule.NAME.violation(" A ", 200, 2)).isEqualTo("tối thiểu 2 ký tự");
        assertThat(FieldRule.NAME.violation("Ấm", 200, 2)).isNull();
        assertThat(FieldRule.NAME.violation("", 200, 2)).isNull();
        assertThat(FieldRule.NAME.violation("x".repeat(201), 200, 2)).isEqualTo("tối đa 200 ký tự");
    }

    @Test
    void serialIgnoresSpacesAndIsStoredUpperCase() {
        assertThat(FieldRule.SERIAL.violation("sn 1234 5678", 0, 3)).isNull();
        assertThat(FieldRule.SERIAL.violation("SN-12#", 0, 3)).isNotNull();
        assertThat(FieldRule.SERIAL.violation("Số1", 0, 3)).isNotNull();
        assertThat(FieldRule.SERIAL.violation("AB", 0, 3)).isEqualTo("tối thiểu 3 ký tự");
        assertThat(FieldRule.SERIAL.violation("A".repeat(51), 0, 3)).isEqualTo("tối đa 50 ký tự");
        assertThat(FieldRule.SERIAL.normalize(" sn 1234/ab-5 ")).isEqualTo("SN1234/AB-5");
    }

    @Test
    void lengthBoundaryCountsCharactersNotBytes() {
        String atLimit = "Đ".repeat(255);
        assertThat(FieldRule.NAME.violation(atLimit, 0)).isNull();
        assertThat(FieldRule.NAME.violation(atLimit + "a", 0)).isEqualTo("tối đa 255 ký tự");
        assertThat(FieldRule.NAME.violation("abc", 2)).isEqualTo("tối đa 2 ký tự");
    }

    @Test
    void emptyIsLeftToNotBlank() {
        for (FieldRule rule : FieldRule.values()) {
            assertThat(rule.violation("", 0)).as(rule.name()).isNull();
            assertThat(rule.violation(null, 0)).as(rule.name()).isNull();
        }
    }

    @Test
    void code() {
        assertThat(FieldRule.CODE.violation("TB-01.A_2", 0)).isNull();
        assertThat(FieldRule.CODE.violation("TB 01", 0)).isNotNull();
        assertThat(FieldRule.CODE.violation("Phòng", 0)).isNotNull();
    }

    @Test
    void name() {
        assertThat(FieldRule.NAME.violation("Bộ thí nghiệm Vật lý 6 (KHTN)", 0)).isNull();
        assertThat(FieldRule.NAME.violation("---", 0)).isNotNull();
        assertThat(FieldRule.NAME.violation("Tên\u0007", 0)).isNotNull();
    }

    @Test
    void personName() {
        assertThat(FieldRule.PERSON_NAME.violation("Nguyễn Thị Thuý Hiệp", 0)).isNull();
        assertThat(FieldRule.PERSON_NAME.violation("O'Neil Trần-Lê", 0)).isNull();
        assertThat(FieldRule.PERSON_NAME.violation("Nguyễn Văn 2", 0)).isNotNull();
    }

    @Test
    void note() {
        assertThat(FieldRule.NOTE.violation("Dòng 1\nDòng 2\tcó tab", 0)).isNull();
        assertThat(FieldRule.NOTE.violation("a\u0000b", 0)).isNotNull();
    }

    @Test
    void email() {
        assertThat(FieldRule.EMAIL.violation("ten.ho@thcs-binhan.edu.vn", 0)).isNull();
        assertThat(FieldRule.EMAIL.violation("ten@", 0)).isNotNull();
        assertThat(FieldRule.EMAIL.violation("ten@truong", 0)).isNotNull();
        assertThat(FieldRule.EMAIL.normalize("Ten@Truong.VN")).isEqualTo("ten@truong.vn");
    }

    @Test
    void phone() {
        assertThat(FieldRule.PHONE.violation("0912 345 678", 0)).isNull();
        assertThat(FieldRule.PHONE.violation("+84 912.345.678", 0)).isNull();
        assertThat(FieldRule.PHONE.violation("(028) 3822 1234", 0)).isNull();
        assertThat(FieldRule.PHONE.violation("12345", 0)).isNotNull();
        assertThat(FieldRule.PHONE.violation("((((((", 0)).isNotNull();
        assertThat(FieldRule.PHONE.normalize("+84 912.345.678")).isEqualTo("0912345678");
    }

    @Test
    void taxCodeAndUrl() {
        assertThat(FieldRule.TAX_CODE.violation("0301234567", 0)).isNull();
        assertThat(FieldRule.TAX_CODE.violation("0301234567-001", 0)).isNull();
        assertThat(FieldRule.TAX_CODE.violation("03012345", 0)).isNotNull();
        assertThat(FieldRule.URL.violation("https://emis.hcm.edu.vn/api", 0)).isNull();
        assertThat(FieldRule.URL.violation("ftp://x", 0)).isNotNull();
    }

    @Test
    void numbers() {
        assertThat(NumberRule.MONEY.violation(BigDecimal.ZERO)).isNull();
        assertThat(NumberRule.MONEY.violation(new BigDecimal("-1"))).isNotNull();
        assertThat(NumberRule.MONEY.violation(new BigDecimal("1.555"))).isEqualTo("tối đa 2 chữ số thập phân");
        assertThat(NumberRule.QUANTITY.violation(BigDecimal.ZERO)).isNotNull();
        assertThat(NumberRule.DECIMAL_QUANTITY.violation(new BigDecimal("0.125"))).isNull();
        assertThat(NumberRule.DECIMAL_QUANTITY.violation(new BigDecimal("0.1255"))).isEqualTo("tối đa 3 chữ số thập phân");
        assertThat(NumberRule.PERCENT.violation(new BigDecimal("100.00"))).isNull();
        assertThat(NumberRule.PERCENT.violation(new BigDecimal("100.01"))).isNotNull();
        assertThat(NumberRule.YEAR.violation(new BigDecimal("1949"))).isNotNull();
        assertThat(NumberRule.YEAR.violation(BigDecimal.valueOf(LocalDate.now().getYear()))).isNull();
    }

    @Test
    void dates() {
        LocalDate today = LocalDate.now(DateRule.VIETNAM);
        assertThat(DateRule.PAST_OR_TODAY.violation(today)).isNull();
        assertThat(DateRule.PAST_OR_TODAY.violation(today.plusDays(1))).isEqualTo("không được sau hôm nay");
        assertThat(DateRule.ANY.violation(today.plusYears(1))).isNull();
        assertThat(DateRule.ANY.violation(LocalDate.of(1949, 12, 31))).isNotNull();
    }

    @Test
    void normalizer() {
        String decomposed = "Nguyễn";
        assertThat(TextNormalizer.normalize("  " + decomposed + "​ ")).isEqualTo("Nguyễn");
        assertThat(TextNormalizer.normalize("")).isEmpty();
        assertThat(TextNormalizer.normalize(null)).isNull();
    }

    @Test
    void passwords() {
        PasswordPolicy.check("p", "Kh0ng-De#Doan", "thcs.canbo");
        PasswordPolicy.check("p", "Kh0ng-De#Doan", "admin", true);
        assertThatThrownBy(() -> PasswordPolicy.check("p", "Kh0ng#Doan", "admin", true))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("12");
        assertThatThrownBy(() -> PasswordPolicy.check("p", "Admin@123", "x"))
                .hasMessageContaining("dễ đoán");
        assertThatThrownBy(() -> PasswordPolicy.check("p", "Xyz@1234ab", "x"))
                .hasMessageContaining("liên tiếp");
        assertThatThrownBy(() -> PasswordPolicy.check("p", "Xyz@aaaa9", "x"))
                .hasMessageContaining("liên tiếp");
        for (int i = 0; i < 200; i++) {
            PasswordPolicy.check("p", PasswordPolicy.temporary(), null);
        }
    }
}
