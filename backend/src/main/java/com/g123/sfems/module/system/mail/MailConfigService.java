package com.g123.sfems.module.system.mail;

import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.SecretBox;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.Properties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cấu hình máy chủ thư lưu trong DB (bảng {@code mail_config}, một dòng id=1). Mật khẩu SMTP mã hoá bằng
 * {@link SecretBox}. Khi DB có {@code host} thì dùng thay cho {@code spring.mail.*} trong properties.
 */
@Service
public class MailConfigService {

    public record Config(String host, int port, String username, boolean hasPassword, String passwordHint,
            String fromAddress, boolean authEnabled, boolean tlsEnabled,
            String updatedAt, String updatedBy) {
    }

    public record Update(
            @Size(max = 255) String host,
            @Min(1) @Max(65535) Integer port,
            @Size(max = 255) String username,
            @Size(max = 500) String password,
            Boolean clearPassword,
            @Text(value = FieldRule.SHORT_TEXT, label = "Địa chỉ gửi", max = 255) String fromAddress,
            Boolean authEnabled,
            Boolean tlsEnabled) {
    }

    private record Row(String host, int port, String username, String sealedPassword, String fromAddress,
            boolean authEnabled, boolean tlsEnabled, OffsetDateTime updatedAt, String updatedBy) {
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
                       m.auth_enabled, m.tls_enabled, m.updated_at,
                       COALESCE(u.full_name, u.username) AS updated_by
                FROM mail_config m LEFT JOIN users u ON u.id = m.updated_by_id WHERE m.id = 1
                """, (rs, i) -> new Row(rs.getString("host"), rs.getInt("port"), rs.getString("username"),
                rs.getString("password"), rs.getString("from_address"),
                rs.getBoolean("auth_enabled"), rs.getBoolean("tls_enabled"),
                rs.getObject("updated_at", OffsetDateTime.class), rs.getString("updated_by")));
    }

    @Transactional(readOnly = true)
    public Config get() {
        Row r = row();
        String pwd = r.sealedPassword() != null && !r.sealedPassword().isBlank()
                ? secrets.open(r.sealedPassword()) : null;
        String hint = pwd != null && pwd.length() >= 4 ? "…" + pwd.substring(pwd.length() - 4) : null;
        return new Config(r.host(), r.port(), r.username(), pwd != null, hint,
                r.fromAddress(), r.authEnabled(), r.tlsEnabled(),
                r.updatedAt() == null ? null : r.updatedAt().toString(), r.updatedBy());
    }

    @Transactional
    public Config update(Update body) {
        Row r = row();
        String host = body.host() != null ? body.host().trim() : r.host();
        int port = body.port() != null ? body.port() : r.port();
        String username = body.username() != null ? body.username().trim() : r.username();
        String sealed = r.sealedPassword();
        if (Boolean.TRUE.equals(body.clearPassword())) {
            sealed = null;
        }
        if (body.password() != null && !body.password().isBlank()) {
            sealed = secrets.seal(body.password().trim());
        }
        String from = body.fromAddress() != null ? body.fromAddress().trim() : r.fromAddress();
        boolean auth = body.authEnabled() != null ? body.authEnabled() : r.authEnabled();
        boolean tls = body.tlsEnabled() != null ? body.tlsEnabled() : r.tlsEnabled();
        jdbc.update("""
                UPDATE mail_config SET host = ?, port = ?, username = ?, password = ?,
                       from_address = ?, auth_enabled = ?, tls_enabled = ?,
                       updated_at = now(), updated_by_id = ? WHERE id = 1
                """, host, port, username, sealed, from, auth, tls, CurrentUser.id().orElse(null));
        return get();
    }

    /** Có cấu hình DB không: host không trống. */
    public boolean hasDbConfig() {
        Row r = row();
        return r.host() != null && !r.host().isBlank();
    }

    /**
     * Dựng {@link JavaMailSenderImpl} từ cấu hình DB. Trả {@code null} nếu host chưa khai.
     */
    public JavaMailSenderImpl buildSender() {
        Row r = row();
        if (r.host() == null || r.host().isBlank()) {
            return null;
        }
        JavaMailSenderImpl s = new JavaMailSenderImpl();
        s.setHost(r.host().trim());
        s.setPort(r.port());
        s.setDefaultEncoding("UTF-8");
        if (r.authEnabled()) {
            s.setUsername(r.username() != null ? r.username().trim() : "");
            String pwd = r.sealedPassword() != null && !r.sealedPassword().isBlank()
                    ? secrets.open(r.sealedPassword()) : "";
            s.setPassword(pwd);
        }
        Properties props = s.getJavaMailProperties();
        props.put("mail.smtp.auth", String.valueOf(r.authEnabled()));
        props.put("mail.smtp.starttls.enable", String.valueOf(r.tlsEnabled()));
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");
        return s;
    }
}
