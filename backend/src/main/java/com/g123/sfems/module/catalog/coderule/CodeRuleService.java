package com.g123.sfems.module.catalog.coderule;

import com.g123.sfems.domain.catalog.coderule.CodeRule;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;

/**
 * Quy tắc sinh mã. Phần chung ở {@link CatalogService}; lớp này giữ hai quy tắc:
 * danh mục đích phải là một danh mục được sinh mã ({@link CodeTargets}), và mỗi
 * danh mục chỉ có một quy tắc.
 */
@org.springframework.stereotype.Service
public class CodeRuleService
        extends CatalogService<CodeRule, CodeRuleRequest, CodeRulePatchRequest> {

    private final CodeRuleRepository repository;

    public CodeRuleService(CodeRuleRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, CodeRule.class, CodeRule::new, "Quy tắc sinh mã");
        this.repository = repository;
    }

    @Override
    protected void applyCreate(CodeRule item, CodeRuleRequest request) {
        item.setTarget(requireTarget(request.target(), null));
        item.setPrefix(blankToNull(request.prefix()));
        item.setSuffix(blankToNull(request.suffix()));
        item.setNumberLength(request.numberLength());
        item.setCurrentNumber(request.currentNumber() == null ? 0L : request.currentNumber());
    }

    @Override
    protected void applyUpdate(CodeRule item, CodeRulePatchRequest request) {
        if (request.target() != null) {
            item.setTarget(requireTarget(request.target(), item.getId()));
        }
        // Tiền tố/hậu tố: "" là xoá (khác null là để nguyên) — form gửi "" khi ô trống.
        if (request.prefix() != null) {
            item.setPrefix(blankToNull(request.prefix()));
        }
        if (request.suffix() != null) {
            item.setSuffix(blankToNull(request.suffix()));
        }
        if (request.numberLength() != null) {
            item.setNumberLength(request.numberLength());
        }
        if (request.currentNumber() != null) {
            item.setCurrentNumber(request.currentNumber());
        }
    }

    @Override
    protected String codeTarget() {
        // Chính quy tắc sinh mã không tự sinh mã cho mình.
        return null;
    }

    private String requireTarget(String raw, Long selfId) {
        String target = raw.trim();
        if (!CodeTargets.ALL.contains(target)) {
            throw new FieldValidationException("target", "Danh mục này không hỗ trợ sinh mã tự động");
        }
        repository.findByTarget(target).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new FieldValidationException(
                        "target", "Danh mục này đã có quy tắc " + existing.getCode());
            }
        });
        return target;
    }
}
