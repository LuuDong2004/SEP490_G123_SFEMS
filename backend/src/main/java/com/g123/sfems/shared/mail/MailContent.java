package com.g123.sfems.shared.mail;

import java.util.ArrayList;
import java.util.List;

/**
 * Nội dung một thư theo khung chung của hệ thống ({@link MailTemplate}): nhãn nhỏ trên đầu, tiêu đề, các đoạn văn,
 * một ô mã nổi bật (mã đăng nhập), một nút mở link và dòng ghi chú cuối thư. Mọi phần trừ tiêu đề đều tuỳ chọn.
 *
 * <p>Nội dung là chữ thuần — khung tự thoát ký tự HTML, nên đưa tên người dùng, lý do… vào thẳng được.
 *
 * <pre>{@code
 * MailContent.titled("Đặt lại mật khẩu")
 *         .paragraph("Có yêu cầu đặt lại mật khẩu cho tài khoản " + username + ".")
 *         .action("Đặt mật khẩu mới", link)
 *         .note("Nếu không phải bạn yêu cầu, bỏ qua thư này.")
 * }</pre>
 */
public record MailContent(String label, String title, List<String> paragraphs, String code, String actionLabel,
        String actionUrl, String note, Tone tone) {

    /** Màu nhấn của tiêu đề — theo mức độ của thông báo. */
    public enum Tone { INFO, SUCCESS, WARNING, ERROR }

    public MailContent {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Thư phải có tiêu đề");
        }
        paragraphs = paragraphs == null ? List.of() : List.copyOf(paragraphs);
        tone = tone == null ? Tone.INFO : tone;
    }

    public static MailContent titled(String title) {
        return new MailContent(null, title, List.of(), null, null, null, null, Tone.INFO);
    }

    public MailContent label(String value) {
        return new MailContent(value, title, paragraphs, code, actionLabel, actionUrl, note, tone);
    }

    /** Thêm một đoạn; {@code null} / rỗng thì bỏ qua (tiện cho phần thân không bắt buộc). */
    public MailContent paragraph(String text) {
        if (text == null || text.isBlank()) {
            return this;
        }
        List<String> next = new ArrayList<>(paragraphs);
        next.add(text);
        return new MailContent(label, title, next, code, actionLabel, actionUrl, note, tone);
    }

    /** Mã hiện to, cách chữ — mã đăng nhập một lần. */
    public MailContent code(String value) {
        return new MailContent(label, title, paragraphs, value, actionLabel, actionUrl, note, tone);
    }

    public MailContent action(String buttonLabel, String url) {
        return new MailContent(label, title, paragraphs, code, buttonLabel, url, note, tone);
    }

    public MailContent note(String value) {
        return new MailContent(label, title, paragraphs, code, actionLabel, actionUrl, value, tone);
    }

    public MailContent tone(Tone value) {
        return new MailContent(label, title, paragraphs, code, actionLabel, actionUrl, note, value);
    }
}
