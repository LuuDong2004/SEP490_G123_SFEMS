package com.g123.sfems.shared.mail;

import org.springframework.mail.javamail.JavaMailSender;

/**
 * Máy chủ thư mà {@link MailService} gửi qua. {@code shared} chỉ khai hợp đồng, nơi lưu cấu hình (màn Cài đặt máy chủ
 * thư của quản trị viên, bảng {@code mail_config}) cài đặt ở {@code module/system/mail} — để {@code shared} không phụ
 * thuộc vào module.
 */
public interface MailServer {

    /** Người gửi ghi trên thư. {@code name} có thể {@code null}. */
    record Sender(String address, String name) {
    }

    /** Công tắc "Gửi thư" đang bật và đã khai máy chủ SMTP. */
    boolean hasDbConfig();

    /** Bộ gửi theo cấu hình hiện tại, {@code null} khi tắt hoặc chưa khai máy chủ. */
    JavaMailSender buildSender();

    /** Người gửi theo cấu hình, {@code null} khi chưa khai địa chỉ gửi lẫn tài khoản SMTP. */
    Sender sender();
}
