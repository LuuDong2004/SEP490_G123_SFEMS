package com.g123.sfems.shared.mail;

import com.g123.sfems.shared.security.PersonalData;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Gửi thư (mã xác thực hai lớp, link đặt lại mật khẩu — QLTB-509).
 *
 * <p>Máy chủ thư khai bằng {@code spring.mail.*} (host, port, username, password) trong
 * {@code application-local.properties} hoặc biến môi trường. CHƯA khai thì Spring không dựng
 * {@link JavaMailSender}, và thư được ghi ra log ở mức WARN thay vì gửi — môi trường dev thử được luồng
 * đăng nhập mà không cần SMTP. Gửi hỏng thì báo lỗi lên trên: người dùng phải biết thư không đi.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final String from;

    public MailService(ObjectProvider<JavaMailSender> sender,
                       @Value("${app.mail.from:no-reply@qltb.local}") String from) {
        this.sender = sender;
        this.from = from;
    }

    public void send(String to, String subject, String body) {
        JavaMailSender mail = sender.getIfAvailable();
        if (mail == null) {
            log.warn("Chưa cấu hình máy chủ thư (spring.mail.host) — thư KHÔNG được gửi.\nTới: {}\nTiêu đề: {}\n{}",
                    to, subject, body);
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        try {
            mail.send(message);
        } catch (MailException e) {
            log.error("Gửi thư tới {} không được: {}", to, e.getMessage());
            throw new IllegalStateException("Không gửi được thư — thử lại sau hoặc liên hệ quản trị viên", e);
        }
    }

    /** {@code nguyenvana@truong.edu.vn} → {@code n*******a@truong.edu.vn}: đủ để người dùng nhận ra hộp thư của mình. */
    public static String mask(String email) {
        return email == null || !email.contains("@") ? "email của tài khoản" : PersonalData.email(email);
    }
}
