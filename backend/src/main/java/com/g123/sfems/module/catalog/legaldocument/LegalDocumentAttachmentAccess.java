package com.g123.sfems.module.catalog.legaldocument;

import com.g123.sfems.shared.data.RecordAccess;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Bản thông tư (PDF hoặc Word) của văn bản căn cứ ({@code resource = legal_documents}): đọc / ghi theo quyền của danh mục, ≤ 20 MB. */
@Component
public class LegalDocumentAttachmentAccess implements RecordAccess {

    private static final long MAX_BYTES = 20L * 1024 * 1024;

    private final LegalDocumentService service;

    public LegalDocumentAttachmentAccess(LegalDocumentService service) {
        this.service = service;
    }

    @Override
    public String resource() {
        return "legal_documents";
    }

    @Override
    public Set<String> allowedExtensions() {
        return Set.of("pdf", "doc", "docx");
    }

    @Override
    public long maxBytes() {
        return MAX_BYTES;
    }

    @Override
    public void checkReadable(Long id) {
        service.get(id);
    }

    @Override
    public void checkWritable(Long id) {
        service.getWritable(id);
    }
}
