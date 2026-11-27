package com.g123.sfems.module.system.notification.api.dto;

import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Raising a notification for somebody, over HTTP.
 *
 * <p>Not how the application normally raises one — features call
 * {@code NotificationService.notify} directly, in the same transaction as the
 * work that warranted it. This exists so that the mechanism can be exercised
 * from the admin UI and from a test without inventing a feature first, which is
 * worth having in a framework whose whole job is to be built on.
 *
 * @param recipientId who it is for. Required: there is no such thing as a
 *                    notification for nobody, and a broadcast is that many rows
 * @param level       null means {@code INFO}
 */
public record NotificationRequest(
        @NotNull(message = "Chọn người nhận")
        Long recipientId,

        NotificationLevel level,

        @NotBlank(message = "Nhập tiêu đề")
        @Text(value = FieldRule.SHORT_TEXT, label = "Tiêu đề")
        String title,

        @Text(value = FieldRule.LONG_TEXT, label = "Nội dung", max = 2000)
        String body,

        // Chỉ đường dẫn trong hệ thống: liên kết ra ngoài ("https://…", "//host", "javascript:") trong một thông báo
        // trông như của hệ thống là lối lừa người nhận bấm vào.
        @Size(max = 500, message = "Liên kết tối đa 500 ký tự")
        @Pattern(regexp = "^$|^/[^/].*", message = "Liên kết phải là đường dẫn trong hệ thống (bắt đầu bằng /)")
        String link) {
}
