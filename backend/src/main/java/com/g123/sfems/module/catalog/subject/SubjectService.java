package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class SubjectService extends CatalogService<Subject, SubjectRequest, SubjectPatchRequest> {

    private final SubjectRepository repository;

    public SubjectService(SubjectRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, Subject.class, Subject::new, "Môn học");
        this.repository = repository;
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    /** Ô tìm nhanh dò cả mã môn ngắn, để gõ "TO" ra được môn Toán. */
    @Override
    protected List<String> searchFields() {
        return List.of("code", "name", "shortCode");
    }

    @Override
    protected void applyCreate(Subject item, SubjectRequest request) {
        item.setShortCode(normalizeShortCode(request.shortCode(), null));
    }

    @Override
    protected void applyUpdate(Subject item, SubjectPatchRequest request) {
        if (request.shortCode() != null) {
            item.setShortCode(normalizeShortCode(request.shortCode(), item.getId()));
        }
    }

    /**
     * Viết hoa, rỗng thành {@code null}, và từ chối mã đã thuộc môn khác. Mã môn là một phần của mã
     * tài sản (DR-08), nên hai môn trùng mã sẽ sinh ra hai tài sản trùng mã.
     */
    private String normalizeShortCode(String raw, Long selfId) {
        String shortCode = blankToNull(raw);
        if (shortCode == null) {
            return null;
        }
        shortCode = shortCode.toUpperCase();
        repository.findByShortCodeIgnoreCase(shortCode)
                .filter(other -> !other.getId().equals(selfId))
                .ifPresent(other -> {
                    throw new FieldValidationException("shortCode",
                            "Mã môn %s đã dùng cho môn %s".formatted(other.getShortCode(), other.getName()));
                });
        return shortCode;
    }
}
