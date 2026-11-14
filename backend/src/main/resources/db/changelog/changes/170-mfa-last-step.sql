--liquibase formatted sql

--changeset qltb:170-mfa-last-step
-- Bước thời gian (epoch / 30 giây) của mã TOTP đăng nhập gần nhất: mã cùng bước hoặc cũ hơn bị từ chối, nên một
-- mã bị nhìn trộm không dùng lại được trong khoảng 30–90 giây nó còn hiệu lực (MfaService.verifyForLogin).
ALTER TABLE users ADD COLUMN mfa_last_step BIGINT;
