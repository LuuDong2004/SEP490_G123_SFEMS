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
        assertThat(field("inventory_sessions", "councilChair")).containsEntry("other", true);
        assertThat(field("inventory_sessions", "councilSecretary")).containsEntry("other", true);
    }

    @Test
    void openEnumKeepsTypedText() {
        String json = forms.header("inventory_sessions", Map.of("inventoryType", "  Kiểm kê đột xuất theo yêu cầu  "),
                null, 1L);
        assertThat(VoucherForms.read(json)).containsEntry("inventoryType", "Kiểm kê đột xuất theo yêu cầu");
    }

    @Test
    void openEnumTextIsBounded() {
        assertThatThrownBy(() -> forms.header("inventory_sessions", Map.of("inventoryType", "x".repeat(300)), null, 1L))
                .isInstanceOf(FieldValidationException.class);
    }

    /** "Người khác" của ô cán bộ: họ tên gõ tay giữ lại (đã gọn khoảng trắng); chuỗi không phải họ tên bị chặn. */
    @Test
    void staffOtherKeepsTypedPersonName() {
        String json = forms.header("inventory_sessions",
                Map.of("councilSecretary", Map.of("name", "  Trần   Thị B ", "other", true)), null, 1L);
        assertThat(VoucherForms.read(json).get("councilSecretary"))
                .isEqualTo(Map.of("name", "Trần Thị B", "other", true));
        assertThatThrownBy(() -> forms.header("inventory_sessions",
                Map.of("councilChair", Map.of("name", "@@123", "other", true)), null, 1L))
                .isInstanceOf(FieldValidationException.class);
    }
}
