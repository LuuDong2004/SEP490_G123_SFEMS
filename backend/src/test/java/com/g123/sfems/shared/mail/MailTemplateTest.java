package com.g123.sfems.shared.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** Khung thư chung: nội dung người dùng nhập bị thoát HTML, có nút + đường dẫn dự phòng, bản chữ thuần đủ ý. */
class MailTemplateTest {

    private final MailContent content = MailContent.titled("Đề xuất <ĐX-01> bị trả lại")
            .label("Kết quả duyệt phiếu")
            .paragraph("Lý do: thiếu \"báo giá\" & hợp đồng.")
            .action("Xem trên hệ thống", "http://localhost:5555/school/purchase-proposals/show/1?a=1&b=2")
            .note("Không muốn nhận email loại này? Vào Hồ sơ cá nhân → Thông báo để tắt.")
            .tone(MailContent.Tone.WARNING);

    @Test
    void htmlEscapesUserTextAndKeepsTheButton() {
        String html = MailTemplate.html(content);

        assertThat(html).contains("Đề xuất &lt;ĐX-01&gt; bị trả lại")
                .contains("thiếu &quot;báo giá&quot; &amp; hợp đồng.")
                .doesNotContain("<ĐX-01>")
                .contains("href=\"http://localhost:5555/school/purchase-proposals/show/1?a=1&amp;b=2\"")
                .contains("Xem trên hệ thống")
                .contains("#b54708")
                .contains(MailTemplate.FOOTER);
    }

    @Test
    void plainTextCarriesTheSameContent() {
        String text = MailTemplate.text(content);

        assertThat(text).startsWith("Kết quả duyệt phiếu\nĐề xuất <ĐX-01> bị trả lại\n\n")
                .contains("Lý do: thiếu \"báo giá\" & hợp đồng.")
                .contains("Xem trên hệ thống: http://localhost:5555/school/purchase-proposals/show/1?a=1&b=2")
                .endsWith("— " + MailTemplate.FOOTER);
    }

    @Test
    void codeIsShownOnItsOwn() {
        MailContent login = MailContent.titled("Mã đăng nhập").code("482913");

        assertThat(MailTemplate.html(login)).contains(">482913</td>").doesNotContain("href=");
        assertThat(MailTemplate.text(login)).contains("    482913\n");
    }

    @Test
    void emptyPartsAreLeftOut() {
        MailContent bare = MailContent.titled("Thư thử").paragraph(null).paragraph("  ");

        assertThat(bare.paragraphs()).isEmpty();
        assertThatThrownBy(() -> MailContent.titled(" ")).isInstanceOf(IllegalArgumentException.class);
    }
}
