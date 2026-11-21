package com.g123.sfems.shared.mail;

import com.g123.sfems.shared.security.DeployStack;
import com.g123.sfems.shared.security.PersonalData;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Cổng gửi thư duy nhất của hệ thống: link đặt lại mật khẩu, thư mời tài khoản, mã đăng nhập, thông báo. Mọi thư dựng
 * từ {@link MailContent} theo khung chung {@link MailTemplate} và đi dưới dạng HTML kèm bản chữ thuần.
 *
 * <p>Máy chủ thư khai bằng {@code spring.mail.*} trong {@code application-local.properties} hoặc biến môi trường — máy
 * dev dùng Mailpit ({@code compose.yaml}, xem thư ở http://localhost:8025), khi demo dùng Gmail SMTP (xem
 * {@code application-local.properties.example}). CHƯA khai {@code spring.mail.host} thì Spring không dựng
 * {@link JavaMailSender}: bản dev ghi thư ra log ở mức WARN thay vì gửi (thử được luồng đăng nhập không cần SMTP);
 * bản chính thức KHÔNG ghi nội dung — thư mang link đặt lại mật khẩu và mã đăng nhập, ai đọc được log là chiếm được
 * tài khoản.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final String from;
    private final String subjectPrefix;
    private final DeployStack stack;

    public MailService(ObjectProvider<JavaMailSender> sender,
                       @Value("${app.mail.from:SFEMS <no-reply@sfems.local>}") String from,
                       @Value("${app.mail.subject-prefix:[SFEMS] }") String subjectPrefix,
                       DeployStack stack) {
        this.sender = sender;
        this.from = from;
        this.subjectPrefix = subjectPrefix;
        this.stack = stack;
    }

    /** Đã khai máy chủ thư chưa ({@code spring.mail.host}). */
    public boolean configured() {
        return sender.getIfAvailable() != null;
    }

    /**
     * Gửi một thư cho người dùng đang chờ nó (link đặt lại mật khẩu, mã đăng nhập). Chưa khai máy chủ thư thì chỉ ghi
     * log; gửi hỏng thì ném lỗi lên trên — người dùng phải biết thư không đi.
     */
    public void send(String to, String subject, MailContent content) {
        if (!deliver(to, subject, content) && stack.production()) {
            log.error("Chưa cấu hình máy chủ thư (spring.mail.host) — thư \"{}\" tới {} KHÔNG được gửi", subject,
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
        JavaMailSender mail = sender.getIfAvailable();
        if (mail == null) {
            if (!stack.production()) {
                log.warn("Chưa cấu hình máy chủ thư (spring.mail.host) — thư KHÔNG được gửi.\nTới: {}\nTiêu đề: {}\n{}",
                        to, fullSubject, text);
            }
            return false;
        }
        try {
            MimeMessage message = mail.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(fullSubject);
            helper.setText(text, MailTemplate.html(content));
            mail.send(message);
            return true;
        } catch (MailException | MessagingException e) {
            log.error("Gửi thư tới {} không được: {}", PersonalData.email(to), e.getMessage());
            throw new IllegalStateException("Không gửi được thư — thử lại sau hoặc liên hệ quản trị viên", e);
        }
    }

    /** {@code nguyenvana@truong.edu.vn} → {@code n*******a@truong.edu.vn}: đủ để người dùng nhận ra hộp thư của mình. */
    public static String mask(String email) {
        return email == null || !email.contains("@") ? "email của tài khoản" : PersonalData.email(email);
    }
}
