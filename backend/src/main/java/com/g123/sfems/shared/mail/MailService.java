package com.g123.sfems.shared.mail;

import com.g123.sfems.module.system.mail.MailConfigService;
import com.g123.sfems.shared.security.DeployStack;
import com.g123.sfems.shared.security.PersonalData;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Cổng gửi thư duy nhất của hệ thống: link đặt lại mật khẩu, thư mời tài khoản, mã đăng nhập, thông báo. Mọi thư dựng
 * từ {@link MailContent} theo khung chung {@link MailTemplate} và đi dưới dạng HTML kèm bản chữ thuần.
 *
 * <p>Máy chủ thư CHỈ lấy theo màn Cài đặt máy chủ thư của quản trị viên ({@link MailConfigService}, bảng
 * {@code mail_config}) — không đọc {@code spring.mail.*} trong tệp cấu hình. Công tắc "Gửi thư" tắt hoặc chưa khai máy
 * chủ thì không gửi: bản dev ghi thư ra log ở mức WARN (thử được luồng đăng nhập không cần SMTP); bản chính thức KHÔNG
 * ghi nội dung — thư mang link đặt lại mật khẩu và mã đăng nhập, ai đọc được log là chiếm được tài khoản.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    /** Địa chỉ gửi dự phòng khi màn quản trị chưa khai địa chỉ gửi lẫn tài khoản SMTP (máy chủ không xác thực). */
    private static final String FALLBACK_FROM = "no-reply@sfems.local";

    private final MailConfigService dbConfig;
    private final String subjectPrefix;
    private final DeployStack stack;

    public MailService(MailConfigService dbConfig,
                       @Value("${app.mail.subject-prefix:[SFEMS] }")
                       String subjectPrefix,
                       DeployStack stack) {
        this.dbConfig = dbConfig;
        this.subjectPrefix = subjectPrefix;
        this.stack = stack;
    }

    /** Gửi được thư không: công tắc "Gửi thư" trên màn quản trị bật và đã khai máy chủ SMTP ở đó. */
    public boolean configured() {
        return dbConfig.hasDbConfig();
    }

    /**
     * Gửi một thư cho người dùng đang chờ nó (link đặt lại mật khẩu, mã đăng nhập). Chưa khai máy chủ thư thì chỉ ghi
     * log; gửi hỏng thì ném lỗi lên trên — người dùng phải biết thư không đi.
     */
    public void send(String to, String subject, MailContent content) {
        if (!deliver(to, subject, content) && stack.production()) {
            log.error("Gửi thư đang tắt hoặc chưa khai máy chủ thư (màn Cài đặt máy chủ thư) — thư \"{}\" tới {} KHÔNG được gửi", subject,
                    PersonalData.email(to));
        }
    }

    /**
     * Gửi một thư; trả {@code false} (không gửi, không lỗi) khi chưa khai máy chủ thư — người gọi tự ghi lại là bỏ
     * qua. Gửi hỏng thì ném {@link IllegalStateException}.
     */
    public boolean deliver(String to, String subject, MailContent content) {
        String fullSubject = subjectPrefix + subject.replaceAll("[\\r\\n]+", " ");
        String text = MailTemplate.text(content);
        JavaMailSender mail = dbConfig.buildSender();
        if (mail == null) {
            if (!stack.production()) {
                log.warn("Gửi thư đang tắt hoặc chưa khai máy chủ thư (màn Cài đặt máy chủ thư) — thư KHÔNG được gửi.\nTới: {}\nTiêu đề: {}\n{}",
                        to, fullSubject, text);
            }
            return false;
        }
        try {
            MimeMessage message = mail.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            MailConfigService.Sender sender = dbConfig.sender();
            if (sender == null) {
                helper.setFrom(FALLBACK_FROM);
            } else if (sender.name() == null) {
                helper.setFrom(sender.address());
            } else {
                helper.setFrom(sender.address(), sender.name());
            }
            helper.setTo(to);
            helper.setSubject(fullSubject);
            helper.setText(text, MailTemplate.html(content));
            mail.send(message);
            return true;
        } catch (MailException | MessagingException | java.io.UnsupportedEncodingException e) {
            log.error("Gửi thư tới {} không được: {}", PersonalData.email(to), e.getMessage());
            throw new IllegalStateException("Không gửi được thư — thử lại sau hoặc liên hệ quản trị viên", e);
        }
    }

    /** {@code nguyenvana@truong.edu.vn} → {@code n*******a@truong.edu.vn}: đủ để người dùng nhận ra hộp thư của mình. */
    public static String mask(String email) {
        return email == null || !email.contains("@") ? "email của tài khoản" : PersonalData.email(email);
    }
}
