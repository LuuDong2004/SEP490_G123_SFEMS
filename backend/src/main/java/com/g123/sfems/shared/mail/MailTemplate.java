package com.g123.sfems.shared.mail;

import org.springframework.web.util.HtmlUtils;

/**
 * Khung chung của mọi thư hệ thống gửi: bản HTML (dải đầu thư mang tên hệ thống, thẻ nội dung, nút, chân thư) và bản
 * chữ thuần cùng nội dung cho ứng dụng thư không đọc HTML.
 *
 * <p>Viết theo luật của thư HTML, không phải trang web: CSS nằm thẳng trong thẻ ({@code style="…"}) vì Gmail, Outlook
 * bỏ {@code <style>}; bố cục và nút bằng bảng (Outlook không hiểu {@code display:inline-block}, bo góc của
 * {@code <a>}); màu nền khai cả {@code bgcolor}; một cột rộng tối đa 600px nên đọc được trên điện thoại.
 */
public final class MailTemplate {

    /** Tên hệ thống ở đầu và chân thư. */
    public static final String SYSTEM_NAME = "Hệ thống quản lý cơ sở vật chất và thiết bị trường học";
    static final String FOOTER = "Thư gửi tự động từ " + SYSTEM_NAME + " (SFEMS). Vui lòng không trả lời thư này.";

    private static final String FONT = "'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
    private static final String BRAND = "#1d4ed8";
    private static final String BRAND_DARK = "#1e3a8a";

    /** Màu của một mức độ: chữ đậm, nền nhạt (nhãn viên), viền (khung ghi chú). */
    private record Palette(String text, String soft, String line) {
    }

    private MailTemplate() {
    }

    public static String html(MailContent c) {
        Palette tone = palette(c.tone());
        StringBuilder body = new StringBuilder();
        if (c.label() != null && !c.label().isBlank()) {
            body.append("<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\"><tr><td bgcolor=\"")
                    .append(tone.soft()).append("\" style=\"background:").append(tone.soft())
                    .append(";border-radius:999px;padding:5px 12px;font-family:").append(FONT)
                    .append(";font-size:12px;font-weight:600;line-height:16px;color:").append(tone.text()).append("\">")
                    .append(esc(c.label())).append("</td></tr></table>");
        }
        body.append("<h1 style=\"margin:16px 0 14px;font-family:").append(FONT)
                .append(";font-size:22px;line-height:30px;font-weight:700;color:#0f172a\">")
                .append(esc(c.title())).append("</h1>");
        for (String p : c.paragraphs()) {
            body.append("<p style=\"margin:0 0 14px;font-family:").append(FONT)
                    .append(";font-size:15px;line-height:24px;color:#334155;white-space:pre-line\">")
                    .append(esc(p)).append("</p>");
        }
        if (c.code() != null && !c.code().isBlank()) {
            body.append("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" "
                    + "style=\"margin:6px 0 20px\"><tr><td align=\"center\" bgcolor=\"#f1f5f9\" style=\"background:#f1f5f9;"
                    + "border:1px dashed #cbd5e1;border-radius:12px;padding:18px 12px;font-family:Consolas,Menlo,"
                    + "'Courier New',monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;"
                    + "color:").append(BRAND_DARK).append("\">").append(esc(c.code())).append("</td></tr></table>");
        }
        if (c.actionUrl() != null && !c.actionUrl().isBlank()) {
            String url = esc(c.actionUrl());
            body.append("<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:8px 0 24px\">"
                    + "<tr><td bgcolor=\"").append(BRAND).append("\" style=\"background:").append(BRAND)
                    .append(";border-radius:10px\"><a href=\"").append(url).append("\" target=\"_blank\" "
                            + "style=\"display:block;padding:13px 28px;font-family:").append(FONT)
                    .append(";font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none\">")
                    .append(esc(label(c))).append("</a></td></tr></table>");
        }
        if (c.note() != null && !c.note().isBlank()) {
            body.append("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" "
                    + "style=\"margin:4px 0 0\"><tr><td bgcolor=\"#f8fafc\" style=\"background:#f8fafc;border-left:4px solid ")
                    .append(tone.line()).append(";border-radius:6px;padding:12px 16px;font-family:").append(FONT)
                    .append(";font-size:13px;line-height:20px;color:#475569\">").append(esc(c.note()))
                    .append("</td></tr></table>");
        }
        if (c.actionUrl() != null && !c.actionUrl().isBlank()) {
            String url = esc(c.actionUrl());
            body.append("<p style=\"margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-family:")
                    .append(FONT).append(";font-size:12px;line-height:18px;color:#94a3b8\">Nút không bấm được? Chép"
                            + " đường dẫn sau vào trình duyệt:<br><a href=\"").append(url)
                    .append("\" style=\"color:#64748b;word-break:break-all\">").append(url).append("</a></p>");
        }
        String preheader = c.paragraphs().isEmpty() ? c.title() : c.paragraphs().getFirst();
        return """
                <!doctype html>
                <html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,\
                initial-scale=1"><title>%1$s</title></head>
                <body style="margin:0;padding:0;background:#eef2f7">
                <div style="display:none;max-height:0;overflow:hidden;opacity:0">%2$s</div>
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" bgcolor="#eef2f7" \
                style="background:#eef2f7">
                <tr><td align="center" style="padding:32px 12px">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:600px">
                <tr><td bgcolor="%3$s" style="background:%3$s;border-radius:16px 16px 0 0;padding:18px 28px">
                <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                <td width="36" height="36" align="center" bgcolor="#ffffff" style="background:#ffffff;\
                border-radius:10px;font-family:%4$s;font-size:18px;font-weight:800;color:%3$s">S</td>
                <td style="padding-left:12px;font-family:%4$s">
                <div style="font-size:16px;line-height:20px;font-weight:700;color:#ffffff;letter-spacing:.5px">SFEMS</div>
                <div style="font-size:12px;line-height:16px;color:#c7d2fe">Quản lý CSVC &amp; thiết bị trường học</div>
                </td></tr></table>
                </td></tr>
                <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:0 0 16px 16px;padding:28px 28px 32px;\
                box-shadow:0 1px 3px rgba(15,23,42,.08)">
                %5$s
                </td></tr>
                <tr><td align="center" style="padding:20px 24px 0;font-family:%4$s;font-size:12px;line-height:18px;\
                color:#94a3b8">%6$s</td></tr>
                </table>
                </td></tr></table>
                </body></html>
                """.formatted(esc(c.title()), esc(preheader), BRAND, FONT, body, esc(FOOTER));
    }

    public static String text(MailContent c) {
        StringBuilder sb = new StringBuilder();
        if (c.label() != null && !c.label().isBlank()) {
            sb.append(c.label()).append('\n');
        }
        sb.append(c.title()).append("\n\n");
        for (String p : c.paragraphs()) {
            sb.append(p).append("\n\n");
        }
        if (c.code() != null && !c.code().isBlank()) {
            sb.append("    ").append(c.code()).append("\n\n");
        }
        if (c.actionUrl() != null && !c.actionUrl().isBlank()) {
            sb.append(label(c)).append(": ").append(c.actionUrl()).append("\n\n");
        }
        if (c.note() != null && !c.note().isBlank()) {
            sb.append(c.note()).append("\n\n");
        }
        return sb.append("— ").append(FOOTER).toString();
    }

    private static String label(MailContent c) {
        return c.actionLabel() == null || c.actionLabel().isBlank() ? "Mở hệ thống" : c.actionLabel();
    }

    private static Palette palette(MailContent.Tone tone) {
        return switch (tone) {
            case ERROR -> new Palette("#b42318", "#fef3f2", "#f04438");
            case WARNING -> new Palette("#b54708", "#fffaeb", "#f79009");
            case SUCCESS -> new Palette("#067647", "#ecfdf3", "#17b26a");
            case INFO -> new Palette(BRAND, "#eff6ff", "#60a5fa");
        };
    }

    private static String esc(String s) {
        return HtmlUtils.htmlEscape(s, "UTF-8");
    }
}
