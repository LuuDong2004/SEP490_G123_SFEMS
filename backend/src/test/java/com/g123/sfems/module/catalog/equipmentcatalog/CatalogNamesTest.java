package com.g123.sfems.module.catalog.equipmentcatalog;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Luật trùng tên của thiết bị ngoài danh mục: so theo bộ từ, không theo cả chuỗi. */
class CatalogNamesTest {

    @Test
    void sameWordsInAnyOrderOrPunctuationAreDuplicates() {
        assertThat(CatalogNames.same("Al bột", "Al (Bột)")).isTrue();
        assertThat(CatalogNames.same("Bột Al", "Al (Bột)")).isTrue();
        assertThat(CatalogNames.same("AL - BỘT", "Al (Bột)")).isTrue();
        assertThat(CatalogNames.same("al (bot)", "Al (Bột)")).isTrue();
        assertThat(CatalogNames.same("Máy  chiếu", "may chieu")).isTrue();
    }

    @Test
    void extraOrMissingWordsAreNotDuplicates() {
        assertThat(CatalogNames.same("Bột nhôm Al", "Al (Bột)")).isFalse();
        assertThat(CatalogNames.same("Al", "Al (Bột)")).isFalse();
        assertThat(CatalogNames.same("", "Al (Bột)")).isFalse();
        assertThat(CatalogNames.same("()", "-")).isFalse();
    }

    @Test
    void mostWordsInCommonIsSimilar() {
        var typed = CatalogNames.words("Bột nhôm Al");
        assertThat(CatalogNames.similarity(typed, CatalogNames.words("Al (Bột)"))).isGreaterThanOrEqualTo(CatalogNames.SIMILAR);
        assertThat(CatalogNames.similarity(typed, CatalogNames.words("Ampe kế một chiều"))).isZero();
    }

    @Test
    void searchWordsSkipSingleLetters() {
        assertThat(CatalogNames.searchWords(CatalogNames.words("Bộ A3 x y"))).containsExactly("bo", "a3");
        assertThat(CatalogNames.searchWords(CatalogNames.words("x y"))).containsExactly("x", "y");
    }
}
