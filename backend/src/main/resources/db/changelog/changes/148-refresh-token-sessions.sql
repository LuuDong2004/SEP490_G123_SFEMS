--liquibase formatted sql

--changeset qltb:148-refresh-token-sessions
-- Quản lý phiên đăng nhập (QLTB-242). Refresh token xoay vòng mỗi lần dùng, nên một PHIÊN là cả chuỗi token nối
-- nhau: session_id đi theo từ token này sang token kế, kèm lúc mở phiên, IP và trình duyệt của lần dùng gần nhất.
-- Token đang có (trước changelog này) thì mỗi token là một phiên riêng.
ALTER TABLE refresh_tokens ADD COLUMN session_id VARCHAR(36);
ALTER TABLE refresh_tokens ADD COLUMN session_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE refresh_tokens ADD COLUMN ip VARCHAR(64);
ALTER TABLE refresh_tokens ADD COLUMN user_agent VARCHAR(300);
UPDATE refresh_tokens SET session_id = md5(id::text || token_hash), session_started_at = created_at;
ALTER TABLE refresh_tokens ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE refresh_tokens ALTER COLUMN session_started_at SET NOT NULL;
CREATE INDEX ix_refresh_tokens_session ON refresh_tokens (session_id);
COMMENT ON COLUMN refresh_tokens.session_id IS 'Phiên đăng nhập — giữ nguyên qua mỗi lần xoay vòng token';
