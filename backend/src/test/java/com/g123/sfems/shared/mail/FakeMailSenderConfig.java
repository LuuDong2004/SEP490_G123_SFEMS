package com.g123.sfems.shared.mail;

import jakarta.mail.internet.MimeMessage;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/**
 * Máy chủ thư giả dùng chung cho các test gửi thư: giữ lại thư đã gửi; bật {@code failing} thì mọi lần gửi đều lỗi.
 * Mọi test thư {@code @Import} cùng lớp này (và cùng thuộc tính) để Spring dùng lại MỘT context — mỗi context riêng là
 * thêm một pool kết nối CSDL.
 */
@TestConfiguration
public class FakeMailSenderConfig {

    /** Thuộc tính chung của các test thư: gửi đồng bộ để kiểm tra ngay. */
    public static final String PROPERTIES = "app.notifications.mail-async=false";

    public static class FakeMailSender extends JavaMailSenderImpl {
        public final List<MimeMessage> sent = new ArrayList<>();
        public boolean failing;

        @Override
        protected void doSend(MimeMessage[] messages, Object[] originals) {
            if (failing) {
                throw new MailSendException("máy chủ thư không trả lời");
            }
            sent.addAll(List.of(messages));
        }
    }

    @Bean
    FakeMailSender javaMailSender() {
        return new FakeMailSender();
    }
}
