--liquibase formatted sql

--changeset qltb:147-password-changed-at
-- Nhắc bảo mật (QLTB-243): biết mật khẩu đã dùng bao lâu để nhắc đổi định kỳ. Tài khoản có sẵn chưa biết lần đổi
-- cuối thì lấy lúc tạo tài khoản — updated_at đổi mỗi lần đăng nhập nên không nói gì về mật khẩu.
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP WITH TIME ZONE;
UPDATE users SET password_changed_at = COALESCE(created_at, now());
COMMENT ON COLUMN users.password_changed_at IS 'Lần đặt / đổi mật khẩu gần nhất — để nhắc đổi định kỳ';
