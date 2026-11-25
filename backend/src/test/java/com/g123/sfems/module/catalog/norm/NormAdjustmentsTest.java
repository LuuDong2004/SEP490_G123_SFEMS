package com.g123.sfems.module.catalog.norm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.catalog.standard.AdjustKind;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.norm.NormAdjustments.Suggestion;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** Luật thuần của điều chỉnh dòng danh mục tối thiểu (changelog 276): mức giảm và gợi ý đọc từ ghi chú. */
class NormAdjustmentsTest {

    private static final BigDecimal ONE = BigDecimal.ONE;
    private static final BigDecimal TWO = BigDecimal.valueOf(2);

    @Test
    void reduceMustBeLessThanTheOriginalRatio() {
        // 1 bộ / 1 HS → 1 bộ / 2 HS: giảm.
        assertThatCode(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_STUDENT, null, ONE, NormBasis.PER_STUDENT, 2))
                .doesNotThrowAnyException();
        // Bằng định mức gốc: không phải giảm.
        assertThatThrownBy(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_STUDENT, 1, ONE, NormBasis.PER_STUDENT, 1))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("ít hơn định mức gốc");
        // 1 / 2 HS → 2 / 2 HS: nhiều hơn.
        assertThatThrownBy(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_STUDENT, 2, TWO, NormBasis.PER_STUDENT, 2))
                .isInstanceOf(FieldValidationException.class);
        // 2 / 6 HS → 1 / 4 HS: 0,25 < 0,33 — giảm.
        assertThatCode(() -> NormAdjustments.checkReduce(TWO, NormBasis.PER_STUDENT, 6, ONE, NormBasis.PER_STUDENT, 4))
                .doesNotThrowAnyException();
    }

    @Test
    void reduceToALargerBasisKeepsTheCountAtMost() {
        // 1 / lớp → 1 / trường: giảm.
        assertThatCode(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_CLASS, null, ONE, NormBasis.PER_SCHOOL, 1))
                .doesNotThrowAnyException();
        // 1 / lớp → 2 / trường: không biết có ít hơn không — không nhận.
        assertThatThrownBy(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_CLASS, null, TWO, NormBasis.PER_SCHOOL, 1))
                .isInstanceOf(FieldValidationException.class);
        // 1 / lớp → 1 / học sinh: đối tượng nhỏ hơn là tăng.
        assertThatThrownBy(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_CLASS, null, ONE, NormBasis.PER_STUDENT, 1))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("đối tượng lớn hơn");
        // Lớp → giáo viên: đổi ngang không so được.
        assertThatThrownBy(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_CLASS, null, ONE, NormBasis.PER_TEACHER, 1))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void reduceNeedsEveryField() {
        assertThatThrownBy(() -> NormAdjustments.checkReduce(null, NormBasis.PER_STUDENT, 1, ONE, NormBasis.PER_STUDENT, 2))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("không giảm được");
        assertThatThrownBy(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_STUDENT, 1, null, NormBasis.PER_STUDENT, 2))
                .isInstanceOf(FieldValidationException.class);
        assertThatThrownBy(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_STUDENT, 1, ONE, null, 2))
                .isInstanceOf(FieldValidationException.class);
        assertThatThrownBy(() -> NormAdjustments.checkReduce(ONE, NormBasis.PER_STUDENT, 1, ONE, NormBasis.PER_STUDENT, 0))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void suggestsReduceFromTheAppendixNote() {
        for (String note : new String[] {"Nơi chưa có điều kiện có thể sử dụng 01 bộ/02HS",
                "Nơi chưa có điều kiện có thể sử dụng 01 bộ/ 02HS", "Nơi chưa có điều kiện có thể sử dụng 1 bộ/2 HS",
                "Nơi chưa có điều kiện có thể sử dụng 01/2HS"}) {
            Suggestion s = NormAdjustments.suggest(note);
            assertThat(s.kind()).as(note).isEqualTo(AdjustKind.REDUCE);
            assertThat(s.quantity()).as(note).isEqualByComparingTo(ONE);
            assertThat(s.basis()).as(note).isEqualTo(NormBasis.PER_STUDENT);
            assertThat(s.basisSize()).as(note).isEqualTo(2);
            assertThat(s.condition()).as(note).isEqualTo("Nơi chưa có điều kiện");
            assertThat(s.basisText()).as(note).isEqualTo(note.replaceAll("\\s+", " "));
        }
    }

    @Test
    void suggestsSubstituteSharedAndGroup() {
        Suggestion it = NormAdjustments.suggest("Cho những nơi chưa có điều kiện sử dụng CNTT");
        assertThat(it.kind()).isEqualTo(AdjustKind.SUBSTITUTE);
        assertThat(it.substituteText()).isEqualTo("CNTT / bài giảng điện tử");
        assertThat(it.substituteRequired()).isTrue();

        Suggestion by = NormAdjustments.suggest("Có thể thay bằng phần mềm mô phỏng.");
        assertThat(by.kind()).isEqualTo(AdjustKind.SUBSTITUTE);
        assertThat(by.substituteText()).isEqualTo("Phần mềm mô phỏng");

        assertThat(NormAdjustments.suggest("Có thể sử dụng thiết bị dùng chung").kind()).isEqualTo(AdjustKind.SHARED);
        assertThat(NormAdjustments.suggest("Sử dụng chung với phần trên").kind()).isEqualTo(AdjustKind.SHARED);

        Suggestion group = NormAdjustments.suggest("Lựa chọn 1 trong 3 đạo cụ");
        assertThat(group.kind()).isEqualTo(AdjustKind.CHOOSE_IN_GROUP);
        assertThat(group.groupPick()).isEqualTo(1);
        assertThat(group.group()).isEqualTo("Đạo cụ");
    }

    @Test
    void noSuggestionForPlainNotes() {
        assertThat(NormAdjustments.suggest(null).kind()).isNull();
        assertThat(NormAdjustments.suggest("  ").kind()).isNull();
        assertThat(NormAdjustments.suggest("Kích thước (720x1020)mm").kind()).isNull();
    }
}
