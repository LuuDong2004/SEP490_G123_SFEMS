package com.g123.sfems.shared.validation;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.shared.security.PasswordPolicy;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * {@code frontend/src/shared/lib/field-rules.json} là BẢN SINH của {@link FieldRule}, {@link NumberRule} và độ dài
 * mật khẩu — frontend kiểm ngay khi gõ bằng đúng các số máy chủ dùng. Lệch nhau thì test này đỏ.
 *
 * <p>Sửa luật ở Java rồi chạy {@code UPDATE_FIELD_RULES=1 ./gradlew test --tests '*FieldRulesExportTest'} để ghi
 * lại tệp.
 */
class FieldRulesExportTest {

    private static final Path TARGET = Path.of("..", "frontend", "src", "shared", "lib", "field-rules.json");

    @Test
    void frontendCopyMatches() throws IOException {
        // CI build backend trong container chỉ chép thư mục backend — không có frontend để đối chiếu thì bỏ qua (máy dev
        // có đủ repo vẫn kiểm như thường).
        Assumptions.assumeTrue(Files.isDirectory(TARGET.getParent()), "không có frontend/ cạnh backend/ — bỏ qua");
        String expected = render();
        if (System.getenv("UPDATE_FIELD_RULES") != null) {
            Files.writeString(TARGET, expected, StandardCharsets.UTF_8);
        }
        assertThat(Files.exists(TARGET)).as(TARGET + " chưa có — chạy với UPDATE_FIELD_RULES=1").isTrue();
        String actual = Files.readString(TARGET, StandardCharsets.UTF_8).replace("\r\n", "\n");
        assertThat(actual).as("field-rules.json lệch với FieldRule — chạy với UPDATE_FIELD_RULES=1").isEqualTo(expected);
    }

    static String render() {
        Map<String, Object> text = new LinkedHashMap<>();
        for (FieldRule rule : FieldRule.values()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("max", rule.max());
            entry.put("pattern", rule.regex());
            entry.put("message", rule.patternMessage());
            if (rule.strip() != null) {
                entry.put("strip", rule.strip());
            }
            text.put(rule.name(), entry);
        }
        Map<String, Object> number = new LinkedHashMap<>();
        for (NumberRule rule : NumberRule.values()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("min", rule.min());
            entry.put("max", rule.max());
            entry.put("scale", rule.scale());
            number.put(rule.name(), entry);
        }
        Map<String, Object> date = new LinkedHashMap<>();
        date.put("floor", DateRule.FLOOR.toString());
        date.put("ceiling", DateRule.CEILING.toString());
        Map<String, Object> password = new LinkedHashMap<>();
        password.put("min", PasswordPolicy.MIN_LENGTH);
        password.put("privilegedMin", PasswordPolicy.PRIVILEGED_MIN_LENGTH);
        password.put("max", PasswordPolicy.MAX_LENGTH);
        password.put("privilegedRoles", PasswordPolicy.PRIVILEGED_ROLES.stream().sorted().toList());

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("$comment", "SINH TỪ FieldRule / NumberRule / PasswordPolicy (backend) — không sửa tay, xem FieldRulesExportTest");
        root.put("text", text);
        root.put("number", number);
        root.put("date", date);
        root.put("password", password);
        ObjectMapper json = JsonMapper.builder().enable(SerializationFeature.INDENT_OUTPUT).build();
        return json.writeValueAsString(root).replace("\r\n", "\n") + "\n";
    }
}
