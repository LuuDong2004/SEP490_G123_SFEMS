package com.g123.sfems.module.system.mail;

import com.g123.sfems.shared.mail.MailContent;
import com.g123.sfems.shared.mail.MailService;
import com.g123.sfems.shared.security.Permissions;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/mail_config} — cấu hình máy chủ thư SMTP (một bản ghi, không theo dialect danh sách) và
 * kiểm tra kết nối. Chỉ ADMIN.
 */
@RestController
@RequestMapping("/api/mail_config")
public class MailConfigController {

    public record TestRequest(@NotBlank @Text(value = FieldRule.EMAIL, label = "Thư điện tử") String email) {
    }

    public record TestResult(boolean sent, String message) {
    }

    private final MailConfigService service;
    private final MailService mail;

    public MailConfigController(MailConfigService service, MailService mail) {
        this.service = service;
        this.mail = mail;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.MAIL_CONFIG_READ + "')")
    public MailConfigService.Config get() {
        return service.get();
    }

    @PutMapping
    @PreAuthorize("hasAuthority('" + Permissions.MAIL_CONFIG_WRITE + "')")
    public MailConfigService.Config update(@Valid @RequestBody MailConfigService.Update body) {
        return service.update(body);
    }

    @PostMapping("/test")
    @PreAuthorize("hasAuthority('" + Permissions.MAIL_CONFIG_WRITE + "')")
    public TestResult test(@Valid @RequestBody TestRequest body) {
        if (!mail.configured()) {
            return new TestResult(false, "Chưa cấu hình máy chủ thư");
        }
        try {
            mail.deliver(body.email().trim(), "Thử kết nối SMTP",
                    MailContent.titled("Máy chủ thư hoạt động bình thường")
                            .label("Thư thử SMTP")
                            .paragraph("Đây là thư thử gửi từ màn Cài đặt máy chủ thư. Nhận được thư này nghĩa là"
                                    + " cấu hình SMTP đúng và hệ thống gửi được email.")
                            .tone(MailContent.Tone.SUCCESS));
            return new TestResult(true, "Đã kết nối và gửi thư thử thành công");
        } catch (IllegalStateException e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            return new TestResult(false, "Không gửi được: " + cause.getMessage());
        }
    }
}
