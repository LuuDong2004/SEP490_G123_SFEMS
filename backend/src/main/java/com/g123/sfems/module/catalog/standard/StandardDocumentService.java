package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import java.net.URI;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StandardDocumentService {
    private final EntityManager entityManager;
    private final EquipmentStandardService standards;

    public StandardDocumentService(EntityManager entityManager, EquipmentStandardService standards) {
        this.entityManager = entityManager;
        this.standards = standards;
    }

    @Transactional(readOnly = true)
    public List<StandardDocumentResponse> list(Long standardId) {
        standards.get(standardId);
        return entityManager.createQuery("""
                SELECT d FROM EquipmentStandardDocument d WHERE d.standard.id = :id
                ORDER BY d.sortOrder, d.id
                """, EquipmentStandardDocument.class)
                .setParameter("id", standardId).getResultList().stream()
                .map(StandardDocumentResponse::from).toList();
    }

    @Transactional
    public StandardDocumentResponse create(Long standardId, StandardDocumentRequest request) {
        var standard = standards.get(standardId);
        EquipmentStandardService.requireDraft(standard);
        EquipmentStandardDocument document = new EquipmentStandardDocument();
        document.setStandard(standard);
        apply(document, request);
        entityManager.persist(document);
        entityManager.flush();
        return StandardDocumentResponse.from(document);
    }

    @Transactional
    public StandardDocumentResponse update(Long standardId, Long documentId, StandardDocumentRequest request) {
        EquipmentStandardService.requireDraft(standards.get(standardId));
        EquipmentStandardDocument document = get(standardId, documentId);
        apply(document, request);
        return StandardDocumentResponse.from(document);
    }

    @Transactional
    public StandardDocumentResponse delete(Long standardId, Long documentId) {
        EquipmentStandardService.requireDraft(standards.get(standardId));
        EquipmentStandardDocument document = get(standardId, documentId);
        StandardDocumentResponse response = StandardDocumentResponse.from(document);
        entityManager.remove(document);
        return response;
    }

    @Transactional(readOnly = true)
    public EquipmentStandardDocument get(Long standardId, Long documentId) {
        EquipmentStandardDocument document = entityManager.find(EquipmentStandardDocument.class, documentId);
        if (document == null || !document.getStandard().getId().equals(standardId)) {
            throw new ResourceNotFoundException("Văn bản", documentId);
        }
        return document;
    }

    private void apply(EquipmentStandardDocument document, StandardDocumentRequest request) {
        if (request.issueDate() != null && request.effectiveDate() != null
                && request.effectiveDate().isBefore(request.issueDate())) {
            throw new FieldValidationException("effectiveDate", "Ngày hiệu lực phải từ ngày ban hành trở đi");
        }
        String number = request.documentNo().trim();
        long duplicates = entityManager.createQuery("""
                SELECT count(d) FROM EquipmentStandardDocument d
                WHERE d.standard = :standard AND d.documentNo = :number AND d.id <> :id
                """, Long.class)
                .setParameter("standard", document.getStandard())
                .setParameter("number", number)
                .setParameter("id", document.getId() == null ? -1L : document.getId())
                .getSingleResult();
        if (duplicates > 0) throw new FieldValidationException("documentNo", "Số hiệu văn bản đã có trong bộ này");
        String url = request.url() == null ? null : request.url().trim();
        if (url != null && !url.isEmpty()) {
            try {
                String scheme = URI.create(url).getScheme();
                if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                    throw new IllegalArgumentException("scheme");
                }
            } catch (IllegalArgumentException ex) {
                throw new FieldValidationException("url", "Đường dẫn văn bản phải bắt đầu bằng http:// hoặc https://");
            }
        }
        document.setDocumentRole(request.documentRole());
        document.setDocumentNo(number);
        document.setDocumentName(request.documentName());
        document.setIssuingAuthority(request.issuingAuthority());
        document.setIssueDate(request.issueDate());
        document.setEffectiveDate(request.effectiveDate());
        document.setUrl(url == null || url.isEmpty() ? null : url);
        document.setSortOrder(request.sortOrder());
    }
}
