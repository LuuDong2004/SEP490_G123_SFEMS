--liquibase formatted sql

--changeset luudong:287-mail-config-v2 splitStatements:false
-- Cải tiến mail_config: thêm enabled (bật/tắt dùng cấu hình DB), security (STARTTLS|SSL|NONE thay cho 2 boolean),
-- sender_name (tên hiển thị bên cạnh from_address). Bỏ auth_enabled và tls_enabled.
ALTER TABLE mail_config
    ADD COLUMN enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
    ADD COLUMN security    VARCHAR(10) NOT NULL DEFAULT 'STARTTLS',
    ADD COLUMN sender_name VARCHAR(255),
    DROP COLUMN auth_enabled,
    DROP COLUMN tls_enabled;
--rollback ALTER TABLE mail_config DROP COLUMN enabled, DROP COLUMN security, DROP COLUMN sender_name, ADD COLUMN auth_enabled BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN tls_enabled BOOLEAN NOT NULL DEFAULT TRUE;
