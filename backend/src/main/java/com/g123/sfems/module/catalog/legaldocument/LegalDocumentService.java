package com.g123.sfems.module.catalog.legaldocument;

import com.g123.sfems.domain.catalog.legaldocument.LegalDocument;
import com.g123.sfems.domain.catalog.legaldocument.LegalDocumentType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Văn bản quy định. Phần chung ở {@link CatalogService}; lớp này giữ: có hiệu lực không trước ngày ban hành,
 * hết hiệu lực sau ngày có hiệu lực, "thay thế" không trỏ chính nó / không vòng, không xoá văn bản đang bị văn bản khác
 * thay thế. Lọc {@code docType=…}, {@code effective=true|false}.
 */
@Service
public class LegalDocumentService
        extends CatalogService<LegalDocument, LegalDocumentRequest, LegalDocumentPatchRequest> {

    /** Số hiệu văn bản: chữ (cả Đ), số, / . - — vd. 37/2021/TT-BGDĐT. */
    public static final String NUMBER_PATTERN = "^[0-9A-Za-zĐđ/.\\-]*$";
    public static final String NUMBER_MESSAGE = "Số hiệu chỉ gồm chữ, số và dấu / . - (vd. 37/2021/TT-BGDĐT)";

    private static final Set<String> SORTABLE = Set.of("id", "code", "name", "sortOrder", "active", "createdAt",
            "updatedAt", "issuedOn", "effectiveFrom", "docType", "issuer");

    private final LegalDocumentRepository repository;

    public LegalDocumentService(LegalDocumentRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, LegalDocument.class, LegalDocument::new, "Văn bản quy định");
        this.repository = repository;
    }

    static LocalDate today() {
        return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    /** Số hiệu do người nhập gõ, không sinh theo quy tắc mã. */
    @Override
    protected String codeTarget() {
        return null;
    }

    @Override
    protected Set<String> sortable() {
        return SORTABLE;
    }

    @Override
    protected List<String> searchFields() {
        return List.of("code", "name", "issuer");
    }

    @Override
    protected void loadForResponse(LegalDocument item) {
        if (item.getReplaces() != null) {
            item.getReplaces().getCode();
        }
    }

    @Override
    protected String codeTakenMessage(String code) {
        return "Đã có văn bản số hiệu " + code;
    }

    @Override
    protected void applyCreate(LegalDocument item, LegalDocumentRequest r) {
        item.setDocType(r.docType());
        item.setIssuer(r.issuer().trim());
        item.setIssuedOn(r.issuedOn());
        item.setEffectiveFrom(r.effectiveFrom());
        item.setEffectiveTo(r.effectiveTo());
        requireDates(item);
        setReplaces(item, r.replaces());
    }

    @Override
    protected void applyUpdate(LegalDocument item, LegalDocumentPatchRequest r) {
        if (r.docType() != null) {
            item.setDocType(r.docType());
        }
        if (r.issuer() != null) {
            item.setIssuer(r.issuer().trim());
        }
        if (r.issuedOn() != null) {
            item.setIssuedOn(r.issuedOn());
        }
        if (r.effectiveFrom() != null) {
            item.setEffectiveFrom(r.effectiveFrom());
        }
        item.setEffectiveTo(r.effectiveTo());
        requireDates(item);
        if (r.replaces() != null) {
            setReplaces(item, r.replaces());
        }
    }

    /**
     * Cho văn bản hết hiệu lực từ {@code endDate} (bị bãi bỏ, không có văn bản thay) — trưởng nhóm 17/11/2026: đổi hiệu
     * lực là một thao tác riêng, không phải một ô của form sửa.
     */
    @Transactional
    public LegalDocument end(Long id, LocalDate endDate) {
        LegalDocument item = getWritable(id);
        if (endDate == null) {
            throw new FieldValidationException("endDate", "Chọn ngày hết hiệu lực");
        }
        if (!endDate.isAfter(item.getEffectiveFrom())) {
            throw new FieldValidationException("endDate", "Ngày hết hiệu lực phải sau ngày có hiệu lực");
        }
        item.setEffectiveTo(endDate);
        loadForResponse(item);
        return item;
    }

    /** Bỏ ngày hết hiệu lực (ghi nhầm) — văn bản còn hiệu lực lại. */
    @Transactional
    public LegalDocument reinstate(Long id) {
        LegalDocument item = getWritable(id);
        item.setEffectiveTo(null);
        loadForResponse(item);
        return item;
    }

    @Override
    protected void beforeDelete(LegalDocument item) {
        if (repository.isReplacedBy(item.getId())) {
            throw new ConflictException("Văn bản đang được ghi là bị thay thế bởi văn bản khác");
        }
    }

    private static void requireDates(LegalDocument item) {
        if (item.getEffectiveFrom().isBefore(item.getIssuedOn())) {
            throw new FieldValidationException("effectiveFrom", "Ngày có hiệu lực không được trước ngày ban hành");
        }
        if (item.getEffectiveTo() != null && !item.getEffectiveTo().isAfter(item.getEffectiveFrom())) {
            throw new FieldValidationException("effectiveTo", "Hết hiệu lực phải sau ngày có hiệu lực");
        }
    }

    private void setReplaces(LegalDocument item, IdRef ref) {
        if (ref == null || ref.id() == null) {
            item.setReplaces(null);
            return;
        }
        if (ref.id().equals(item.getId())) {
            throw new FieldValidationException("replaces", "Văn bản không thay thế chính nó");
        }
        LegalDocument target = get(ref.id());
        // Không vòng: đi theo chuỗi "thay thế" của văn bản được chọn, không được gặp lại văn bản đang sửa.
        Set<Long> seen = new HashSet<>();
        for (LegalDocument d = target; d != null && seen.add(d.getId()); d = d.getReplaces()) {
            if (item.getId() != null && d.getId().equals(item.getId())) {
                throw new FieldValidationException("replaces", "Chọn văn bản này sẽ tạo vòng thay thế");
            }
        }
        item.setReplaces(target);
        // Thông tư mới thay hẳn thông tư cũ: thông tư cũ hết hiệu lực từ ngày thông tư mới có hiệu lực.
        LocalDate end = item.getEffectiveFrom();
        if (end != null && end.isAfter(target.getEffectiveFrom())
                && (target.getEffectiveTo() == null || target.getEffectiveTo().isAfter(end))) {
            target.setEffectiveTo(end);
        }
    }

    @Override
    protected Specification<LegalDocument> extraFilters(ListParams params) {
        List<Specification<LegalDocument>> specs = new ArrayList<>();
        LocalDate day = today();
        for (ListParams.Criterion c : params.filters()) {
            if (c.field().equals("docType")) {
                LegalDocumentType type;
                try {
                    type = LegalDocumentType.valueOf(c.value());
                } catch (IllegalArgumentException e) {
                    specs.add((root, query, cb) -> cb.disjunction());
                    continue;
                }
                specs.add((root, query, cb) -> cb.equal(root.get("docType"), type));
            } else if (c.field().equals("effective")) {
                Specification<LegalDocument> on = (root, query, cb) -> cb.and(
                        cb.isTrue(root.get("active")),
                        cb.lessThanOrEqualTo(root.get("effectiveFrom"), day),
                        cb.or(cb.isNull(root.get("effectiveTo")), cb.greaterThan(root.get("effectiveTo"), day)));
                specs.add("true".equals(c.value()) ? on : Specification.not(on));
            }
        }
        return Specification.allOf(specs);
    }
}
