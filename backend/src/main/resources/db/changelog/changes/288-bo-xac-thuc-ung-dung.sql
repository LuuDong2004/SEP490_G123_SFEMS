--liquibase formatted sql

--changeset luudong:288-bo-xac-thuc-ung-dung
-- Bỏ xác thực bằng ứng dụng (TOTP, changelog 065 và 170): chỉ còn mã 6 số gửi qua email lúc đăng nhập (130). Giữ
-- mfa_failed_attempts và mfa_locked_until — bộ đếm nhập sai mã email dùng hai cột này.
ALTER TABLE users
    DROP COLUMN mfa_secret,
    DROP COLUMN mfa_enabled,
    DROP COLUMN mfa_last_step;
--rollback ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(255), ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN mfa_last_step BIGINT;
