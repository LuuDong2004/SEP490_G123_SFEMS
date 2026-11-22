package com.g123.sfems.module.school.voucher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Ô chọn của phần chứng từ có mục "Khác" để gõ tay.
 */
class VoucherFormsOtherTest {

    private final VoucherForms forms = new VoucherForms(null);

    VoucherFormsOtherTest() throws IOException {
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> field(String resource, String key) {
        Map<String, Object> form = forms.form(resource);
        for (Object section : (List<Object>) form.get("sections")) {
            for (Object f : (List<Object>) ((Map<String, Object>) section).get("fields")) {
                if (key.equals(((Map<String, Object>) f).get("key"))) {
                    return (Map<String, Object>) f;
                }
            }
        }
        for (Object f : (List<Object>) form.get("line")) {
            if (key.equals(((Map<String, Object>) f).get("key"))) {
                return (Map<String, Object>) f;
            }
        }
        throw new AssertionError("không có trường " + key);
    }

    @Test
    void enumFieldsAreOpen() {
        assertThat(field("inventory_sessions", "inventoryType")).containsEntry("other", true);
        assertThat(field("inventory_sessions", "proposedAction")).containsEntry("other", true);
    }

    @Test
    void openEnumKeepsTypedText() {
        String json = forms.header("inventory_sessions", Map.of("inventoryType", "  Kiểm kê đột xuất theo yêu cầu  "),
                null, 1L, null);
        assertThat(VoucherForms.read(json)).containsEntry("inventoryType", "Kiểm kê đột xuất theo yêu cầu");
    }

    @Test
    void openEnumTextIsBounded() {
        assertThatThrownBy(() -> forms.line("inventory_sessions", Map.of("proposedAction", "x".repeat(300)), 1L, 1))
                .isInstanceOf(FieldValidationException.class);
    }
}
