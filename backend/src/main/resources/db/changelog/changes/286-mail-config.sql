--liquibase formatted sql

--changeset luudong:286-mail-config splitStatements:false
-- Cấu hình máy chủ thư lưu trong DB (màn Quản trị → "Cài đặt máy chủ thư"): host, cổng, tên đăng nhập, mật khẩu
-- (mã hoá SecretBox), địa chỉ gửi, bật xác thực, bật STARTTLS. MỘT dòng (id = 1). Ưu tiên hơn spring.mail.* trong
-- application-local.properties — dev vẫn dùng properties nếu DB chưa có host.
CREATE TABLE mail_config (
    id              SMALLINT      PRIMARY KEY DEFAULT 1,
    host            VARCHAR(255),
    port            INT           NOT NULL DEFAULT 587,
    username        VARCHAR(255),
    password        VARCHAR(2000),
    from_address    VARCHAR(255),
    auth_enabled    BOOLEAN       NOT NULL DEFAULT TRUE,
    tls_enabled     BOOLEAN       NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ,
    updated_by_id   BIGINT        REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_mail_config_single CHECK (id = 1)
);
COMMENT ON COLUMN mail_config.password IS 'Mật khẩu SMTP đã mã hoá (SecretBox, AES-GCM) — không bao giờ trả ra API';
INSERT INTO mail_config (id) VALUES (1);

INSERT INTO permissions (code, name, description, system_permission, scope) VALUES
    ('mail_config:read',  'Xem cấu hình máy chủ thư',  'Xem thông số kết nối SMTP', TRUE, 'SYSTEM'),
    ('mail_config:write', 'Sửa cấu hình máy chủ thư', 'Nhập / đổi thông số SMTP, kiểm tra kết nối', TRUE, 'SYSTEM');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN' AND p.code IN ('mail_config:read', 'mail_config:write')
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'mail_config:%');
--rollback DELETE FROM permissions WHERE code LIKE 'mail_config:%';
--rollback DROP TABLE mail_config;
