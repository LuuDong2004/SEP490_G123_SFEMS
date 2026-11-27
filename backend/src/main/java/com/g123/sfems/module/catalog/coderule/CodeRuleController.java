package com.g123.sfems.module.catalog.coderule;

import com.g123.sfems.domain.catalog.coderule.CodeRule;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.util.HashMap;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/code_rules} — mã quyền {@code code_rules:*} suy ra từ {@link #resource()}. */
@RestController
@RequestMapping("/api/code_rules")
public class CodeRuleController
        extends CatalogController<CodeRule, CodeRuleRequest, CodeRulePatchRequest> {

    private final CodeGenerator generator;

    public CodeRuleController(
            CodeRuleService service, RowLevelSecurity rowLevel, CodeGenerator generator) {
        super(service, rowLevel);
        this.generator = generator;
    }

    @Override
    protected String resource() {
        return "code_rules";
    }

    @Override
    protected Object respond(CodeRule item, RowLevelSecurity rowLevel) {
        return CodeRuleResponse.from(item, rowLevel);
    }

    /**
     * Mã gợi ý cho bản ghi mới của một danh mục — form tạo mới điền sẵn. Không
     * tăng bộ đếm. Ai được thêm mục vào danh mục đó ({@code <target>:write}) thì
     * được hỏi, không cần quyền xem quy tắc. {@code code} là {@code null} khi
     * danh mục chưa có quy tắc hoặc quy tắc đang ngưng dùng.
     */
    /**
     * Số lớn nhất đã cấp theo khuôn tiền tố / hậu tố trong danh mục {@code target} — form quy tắc báo ngay khi ô "Đã
     * cấp đến số" đặt lùi dưới số đó (máy chủ vẫn kiểm lại lúc lưu). {@code number} là {@code null} khi chưa có mã nào.
     */
    @GetMapping("/largest")
    @PreAuthorize("hasAuthority('code_rules:read')")
    public Map<String, Object> largest(@RequestParam String target,
            @RequestParam(required = false) String prefix, @RequestParam(required = false) String suffix) {
        Map<String, Object> body = new HashMap<>();
        if (!CodeTargets.ALL.contains(target)) {
            body.put("number", null);
            body.put("code", null);
            return body;
        }
        var issued = generator.largestIssued(target, blank(prefix), blank(suffix));
        body.put("number", issued.map(CodeGenerator.Issued::number).orElse(null));
        body.put("code", issued.map(CodeGenerator.Issued::code).orElse(null));
        return body;
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @GetMapping("/next")
    @PreAuthorize("hasAuthority(#target + ':write')")
    public Map<String, String> next(@RequestParam String target) {
        Map<String, String> body = new HashMap<>();
        body.put("code", generator.peek(target).orElse(null));
        return body;
    }
}
