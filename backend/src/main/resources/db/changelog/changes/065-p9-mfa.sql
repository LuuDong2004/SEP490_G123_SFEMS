--liquibase formatted sql

--changeset dth:065-p9-mfa
--comment P9 — xác thực hai yếu tố (TOTP, RFC 6238) cho tài khoản. Bí mật TOTP lưu đã mã hoá (AES-GCM, khoá dẫn từ bí mật ký JWT) — một bản sao lưu cơ sở dữ liệu bị lộ không đủ để sinh mã. Đếm số lần nhập sai để khoá tạm, vì mã 6 số chỉ có một triệu khả năng.

ALTER TABLE users
    ADD COLUMN mfa_secret          VARCHAR(255),
    ADD COLUMN mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN mfa_failed_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN mfa_locked_until    TIMESTAMP WITH TIME ZONE;
