package com.g123.sfems.module.catalog.legaldocument;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.catalog.legaldocument.LegalDocument;
import com.g123.sfems.domain.catalog.legaldocument.LegalDocumentType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.LocalDate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

/** Văn bản quy định: ngày ban hành / hiệu lực, thay thế không vòng, không xoá văn bản đang bị thay thế. */
@SpringBootTest
@Transactional
class LegalDocumentRulesTest {

    @Autowired
    LegalDocumentService service;

    @BeforeEach
    void login() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("t", "t",
                "legal_documents:read", "legal_documents:write", "legal_documents:delete"));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private LegalDocumentRequest request(String code, LocalDate issued, LocalDate from, LocalDate to, Long replaces) {
        return new LegalDocumentRequest(code, "Văn bản thử " + code, null, true, null, LegalDocumentType.THONG_TU,
                "Bộ Giáo dục và Đào tạo", issued, from, to, replaces == null ? null : new IdRef(replaces));
    }

    @Test
    void datesMustBeInOrder() {
        LocalDate d = LocalDate.of(2025, 1, 10);
        assertThatThrownBy(() -> service.create(request("T1/2025/TT", d, d.minusDays(1), null, null)))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("trước ngày ban hành");
        assertThatThrownBy(() -> service.create(request("T2/2025/TT", d, d, d, null)))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("sau ngày có hiệu lực");
        LegalDocument ok = service.create(request("T3/2025/TT", d, d, null, null));
        assertThat(ok.effectiveOn(LocalDate.of(2025, 6, 1))).isTrue();
        assertThat(ok.effectiveOn(d.minusDays(1))).isFalse();
    }

    @Test
    void replacesHasNoCycleAndBlocksDelete() {
        LocalDate d = LocalDate.of(2025, 1, 10);
        LegalDocument old = service.create(request("T4/2025/TT", d, d, null, null));
        LegalDocument fresh = service.create(request("T5/2025/TT", d, d, null, old.getId()));
        assertThat(fresh.getReplaces().getId()).isEqualTo(old.getId());
        assertThatThrownBy(() -> service.update(old.getId(), new LegalDocumentPatchRequest(null, null, null, null,
                null, null, null, null, null, null, new IdRef(fresh.getId()))))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("vòng");
        assertThatThrownBy(() -> service.delete(old.getId())).isInstanceOf(ConflictException.class);
    }
}
