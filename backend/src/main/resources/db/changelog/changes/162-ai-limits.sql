--liquibase formatted sql

--changeset qltb:162-ai-limits
-- Trần chi phí AI: ngân sách USD mỗi tháng của cả hệ thống và số lần gọi tối đa mỗi người mỗi giờ. Máy chủ kiểm
-- TRƯỚC khi gọi Anthropic (AiSettingsService.requireQuota) — hết ngân sách thì nút AI báo, không gọi nữa.
ALTER TABLE ai_settings
    ADD COLUMN monthly_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 5,
    ADD COLUMN user_hourly_limit  INTEGER        NOT NULL DEFAULT 20,
    ADD CONSTRAINT ck_ai_settings_budget CHECK (monthly_budget_usd > 0),
    ADD CONSTRAINT ck_ai_settings_hourly CHECK (user_hourly_limit > 0);

-- Mô hình mặc định: Haiku (ghép trong danh sách cho sẵn — Haiku đủ, rẻ hơn Opus nhiều lần). Đổi cả dòng cấu hình
-- nếu quản trị viên chưa từng lưu (updated_at trống); đã chọn tay thì giữ.
ALTER TABLE ai_settings ALTER COLUMN model SET DEFAULT 'claude-haiku-5-5';
UPDATE ai_settings SET model = 'claude-haiku-5-5' WHERE model = 'claude-opus-5-5' AND updated_at IS NULL;

-- Đếm lần gọi của một người trong giờ qua.
CREATE INDEX ix_ai_calls_user_called_at ON ai_calls (user_id, called_at DESC);
