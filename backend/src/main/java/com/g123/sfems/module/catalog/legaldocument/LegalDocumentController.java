package com.g123.sfems.module.catalog.legaldocument;

import com.g123.sfems.domain.catalog.legaldocument.LegalDocument;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/legal_documents} — Văn bản quy định: Sở, quản trị ghi; mọi cổng nghiệp vụ đọc. */
@RestController
@RequestMapping("/api/legal_documents")
public class LegalDocumentController extends CatalogController<
        LegalDocument, LegalDocumentRequest, LegalDocumentPatchRequest> {

    private final LegalDocumentService documents;
    private final RowLevelSecurity rowLevel;

    public LegalDocumentController(LegalDocumentService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
        this.documents = service;
        this.rowLevel = rowLevel;
    }

    /** {@code POST /api/legal_documents/{id}/end} {@code {"endDate": "2026-12-01"}} — cho văn bản hết hiệu lực. */
    @PostMapping("/{id}/end")
    @PreAuthorize("hasAuthority(#root.this.authority('write'))")
    public Object end(@PathVariable Long id, @Valid @RequestBody EndRequest body) {
        return respond(documents.end(id, body.endDate()), rowLevel);
    }

    /** {@code POST /api/legal_documents/{id}/reinstate} — bỏ ngày hết hiệu lực, văn bản còn hiệu lực lại. */
    @PostMapping("/{id}/reinstate")
    @PreAuthorize("hasAuthority(#root.this.authority('write'))")
    public Object reinstate(@PathVariable Long id) {
        return respond(documents.reinstate(id), rowLevel);
    }

    /** Ngày văn bản hết hiệu lực. */
    public record EndRequest(@DateValue(value = DateRule.ANY, label = "Ngày hết hiệu lực") LocalDate endDate) {
    }

    @Override
    protected String resource() {
        return "legal_documents";
    }

    @Override
    protected Object respond(LegalDocument item, RowLevelSecurity rowLevel) {
        return LegalDocumentResponse.from(item, rowLevel);
    }
}
