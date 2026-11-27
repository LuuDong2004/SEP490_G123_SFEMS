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

    @Override
    protected boolean codeLocked() {
        return true;
    }

    private final CodeRuleRepository repository;
    private final CodeGenerator generator;

    public CodeRuleService(CodeRuleRepository repository, RowLevelSecurity rowLevel, CodeGenerator generator) {
        super(repository, rowLevel, CodeRule.class, CodeRule::new, "Quy tắc sinh mã");
        this.repository = repository;
        this.generator = generator;
    }

    @Override
    protected void applyCreate(CodeRule item, CodeRuleRequest request) {
        item.setTarget(requireTarget(request.target(), null));
        item.setPrefix(blankToNull(request.prefix()));
        item.setSuffix(blankToNull(request.suffix()));
        item.setNumberLength(request.numberLength());
        item.setCurrentNumber(request.currentNumber() == null ? 0L : request.currentNumber());
        requireNumberFits(item);
    }

    @Override
    protected void applyUpdate(CodeRule item, CodeRulePatchRequest request) {
        String before = shape(item);
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
        // Chỉ kiểm khi khuôn hay số THẬT SỰ đổi: sửa tên, ghi chú của một quy tắc cũ (số đang lùi sau mã gõ tay) không
        // bị chặn vì lỗi nó không gây ra — máy cấp vẫn bỏ qua mã đã có.
        if (!before.equals(shape(item))) {
            requireNumberFits(item);
        }
    }

    private static String shape(CodeRule r) {
        return r.getTarget() + "|" + r.getPrefix() + "|" + r.getSuffix() + "|" + r.getNumberLength() + "|"
                + r.getCurrentNumber();
    }

    /**
     * Số đã cấp phải vừa độ dài phần số (3 chữ số thì tối đa 999 — số kế tiếp 1000 làm mã dài hơn khuôn), và không
     * thấp hơn số lớn nhất đã cấp: đặt lùi thì mã máy cấp vấp trùng mã cũ.
     */
    private void requireNumberFits(CodeRule rule) {
        int length = rule.getNumberLength() == null ? 0 : rule.getNumberLength();
        long current = rule.getCurrentNumber() == null ? 0L : rule.getCurrentNumber();
        long ceiling = (long) Math.pow(10, length);
        if (length > 0 && current >= ceiling) {
            throw new FieldValidationException("currentNumber",
                    "Đã cấp đến số phải nhỏ hơn %d (phần số dài %d chữ số)".formatted(ceiling, length));
        }
        generator.largestIssued(rule.getTarget(), rule.getPrefix(), rule.getSuffix())
                .filter(issued -> issued.number() > current)
                .ifPresent(issued -> {
                    throw new FieldValidationException("currentNumber",
                            "Đã cấp đến số không được nhỏ hơn %d — mã %s đã cấp".formatted(issued.number(), issued.code()));
                });
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
