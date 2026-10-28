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
    @GetMapping("/next")
    @PreAuthorize("hasAuthority(#target + ':write')")
    public Map<String, String> next(@RequestParam String target) {
        Map<String, String> body = new HashMap<>();
        body.put("code", generator.peek(target).orElse(null));
        return body;
    }
}
