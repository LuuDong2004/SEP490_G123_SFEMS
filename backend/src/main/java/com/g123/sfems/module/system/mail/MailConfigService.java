package com.g123.sfems.module.system.mail;

import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.SecretBox;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.Properties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cấu hình máy chủ thư lưu trong DB (bảng {@code mail_config}, một dòng id=1). Mật khẩu SMTP mã hoá bằng
 * {@link SecretBox}. Đây là cấu hình máy chủ thư DUY NHẤT: {@code spring.mail.*} trong tệp cấu hình không được dùng.
 * Chỉ gửi khi {@code enabled=true} và đã khai {@code host}.
 */
@Service
public class MailConfigService {

    /** Kiểu bảo mật kết nối SMTP. */
    public enum Security { STARTTLS, SSL, NONE }

    public record Config(String host, int port, String username, boolean hasPassword, String passwordHint,
            String fromAddress, String senderName, Security security, boolean enabled,
            String updatedAt, String updatedBy) {
    }

    /** Tên máy (smtp.gmail.com, localhost) hoặc IPv4 — có "smtp://", cổng hay khoảng trắng là gõ nhầm ô. */
    static final String HOST_PATTERN =
            "^$|^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$";

    public record Update(
            @Size(max = 253, message = "Máy chủ SMTP tối đa 253 ký tự")
            @Pattern(regexp = HOST_PATTERN, message = "Máy chủ SMTP không hợp lệ (vd. smtp.gmail.com)") String host,
            @Min(1) @Max(65535) Integer port,
            @Text(value = FieldRule.SHORT_TEXT, label = "Tài khoản", max = 255) String username,
            @Size(max = 500) String password,
            Boolean clearPassword,
            @Text(value = FieldRule.EMAIL, label = "Địa chỉ gửi") String fromAddress,
            @Text(value = FieldRule.SHORT_TEXT, label = "Tên người gửi", max = 100) String senderName,
            Security security,
            Boolean enabled) {
    }

    private record Row(String host, int port, String username, String sealedPassword,
            String fromAddress, String senderName, Security security, boolean enabled,
            OffsetDateTime updatedAt, String updatedBy) {
    }

    private final JdbcTemplate jdbc;
    private final SecretBox secrets;

    public MailConfigService(JdbcTemplate jdbc, SecretBox secrets) {
        this.jdbc = jdbc;
        this.secrets = secrets;
    }

    private Row row() {
        return jdbc.queryForObject("""
                SELECT m.host, m.port, m.username, m.password, m.from_address,
                       m.sender_name, m.security, m.enabled, m.updated_at,
                       COALESCE(u.full_name, u.username) AS updated_by
                FROM mail_config m LEFT JOIN users u ON u.id = m.updated_by_id WHERE m.id = 1
                """, (rs, i) -> {
            Security sec;
            try { sec = Security.valueOf(rs.getString("security")); }
            catch (Exception e) { sec = Security.STARTTLS; }
            return new Row(rs.getString("host"), rs.getInt("port"), rs.getString("username"),
                    rs.getString("password"), rs.getString("from_address"),
                    rs.getString("sender_name"), sec, rs.getBoolean("enabled"),
                    rs.getObject("updated_at", OffsetDateTime.class), rs.getString("updated_by"));
        });
    }

    @Transactional(readOnly = true)
    public Config get() {
        Row r = row();
        String pwd = r.sealedPassword() != null && !r.sealedPassword().isBlank()
                ? secrets.open(r.sealedPassword()) : null;
        String hint = pwd != null && pwd.length() >= 4 ? "…" + pwd.substring(pwd.length() - 4) : null;
        return new Config(r.host(), r.port(), r.username(), pwd != null, hint,
                r.fromAddress(), r.senderName(), r.security(), r.enabled(),
                r.updatedAt() == null ? null : r.updatedAt().toString(), r.updatedBy());
    }

    @Transactional
    public Config update(Update body) {
        Row r = row();
        String host       = body.host()       != null ? body.host().trim()       : r.host();
        int    port       = body.port()        != null ? body.port()              : r.port();
        String username   = body.username()    != null ? body.username().trim()   : r.username();
        String senderName = body.senderName()  != null ? body.senderName().trim() : r.senderName();
        String from       = body.fromAddress() != null ? FieldRule.EMAIL.normalize(body.fromAddress().trim()) : r.fromAddress();
        Security security = body.security()    != null ? body.security()          : r.security();
        boolean enabled   = body.enabled()     != null ? body.enabled()           : r.enabled();
        // Kiểm trên giá trị SAU khi gộp: bật công tắc mà không có máy chủ thì màn báo "đang gửi" nhưng không thư nào đi.
        if (enabled && (host == null || host.isBlank())) {
            throw new FieldValidationException("host", "Bật gửi thư thì phải khai máy chủ SMTP");
        }
        String sealed = r.sealedPassword();
        if (Boolean.TRUE.equals(body.clearPassword())) {
            sealed = null;
        }
        if (body.password() != null && !body.password().isBlank()) {
            sealed = secrets.seal(body.password().trim());
        }
        jdbc.update("""
                UPDATE mail_config SET host = ?, port = ?, username = ?, password = ?,
                       from_address = ?, sender_name = ?, security = ?, enabled = ?,
                       updated_at = now(), updated_by_id = ? WHERE id = 1
                """, host, port, username, sealed, from, senderName, security.name(), enabled,
                CurrentUser.id().orElse(null));
        return get();
    }

    /** Có cấu hình DB đang bật không: enabled=true và host không trống. */
    public boolean hasDbConfig() {
        Row r = row();
        return r.enabled() && r.host() != null && !r.host().isBlank();
    }

    /** Người gửi ghi trên thư: địa chỉ gửi đã khai, không khai thì tài khoản SMTP; tên hiển thị nếu có. */
    public record Sender(String address, String name) {
    }

    /** Người gửi theo cấu hình trên màn quản trị; {@code null} khi chưa khai địa chỉ gửi lẫn tài khoản SMTP. */
    public Sender sender() {
        Row r = row();
        String address = r.fromAddress() != null && !r.fromAddress().isBlank() ? r.fromAddress().trim()
                : r.username() != null && !r.username().isBlank() ? r.username().trim() : null;
        if (address == null) {
            return null;
        }
        return new Sender(address, r.senderName() == null || r.senderName().isBlank() ? null : r.senderName().trim());
    }

    /**
     * Dựng {@link JavaMailSenderImpl} từ cấu hình DB. Trả {@code null} nếu host chưa khai hoặc tắt.
     */
    public JavaMailSenderImpl buildSender() {
        Row r = row();
        if (!r.enabled() || r.host() == null || r.host().isBlank()) {
            return null;
        }
        JavaMailSenderImpl s = new JavaMailSenderImpl();
        s.setHost(r.host().trim());
        s.setPort(r.port());
        s.setDefaultEncoding("UTF-8");
        boolean auth = r.security() != Security.NONE;
        if (auth) {
            s.setUsername(r.username() != null ? r.username().trim() : "");
            String pwd = r.sealedPassword() != null && !r.sealedPassword().isBlank()
                    ? secrets.open(r.sealedPassword()) : "";
            s.setPassword(pwd);
        }
        Properties props = s.getJavaMailProperties();
        props.put("mail.smtp.auth", String.valueOf(auth));
        props.put("mail.smtp.starttls.enable", String.valueOf(r.security() == Security.STARTTLS));
        props.put("mail.smtp.ssl.enable", String.valueOf(r.security() == Security.SSL));
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");
        return s;
    }
}
