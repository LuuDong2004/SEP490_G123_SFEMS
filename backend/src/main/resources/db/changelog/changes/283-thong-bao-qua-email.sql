--liquibase formatted sql

--changeset luudong:283-thong-bao-qua-email splitStatements:false
-- Thông báo gửi qua email (HT-06): thông báo có LOẠI; mỗi loại bật / tắt được trên hệ thống và qua email (quản trị,
-- toàn hệ thống); người dùng bật / tắt email từng loại của mình; vết gửi thư để tra "vì sao không nhận được" và để
-- thử gửi lại thư lỗi.
ALTER TABLE notifications ADD COLUMN type VARCHAR(40) NOT NULL DEFAULT 'ADMIN_MESSAGE';

-- Thông báo cũ: suy loại theo tiêu đề / đường dẫn của các nơi phát (VoucherProgressNotifier, VoucherDecisionNotifier,
-- CampaignLaunchNotifier, hồ sơ năm học).
UPDATE notifications SET type = CASE
    WHEN title LIKE '%chờ duyệt' THEN 'VOUCHER_PENDING'
    WHEN title LIKE '%đã được duyệt' OR title LIKE '%bị từ chối' OR title LIKE '%bị trả lại, cần sửa' THEN 'VOUCHER_RESULT'
    WHEN title LIKE 'Đợt kiểm kê mới%' THEN 'INVENTORY_CAMPAIGN'
    WHEN link = '/equipment-minimum' OR link LIKE '/school-year-profile%' THEN 'YEAR_PROFILE'
    ELSE 'ADMIN_MESSAGE' END;

CREATE INDEX idx_notifications_recipient_type ON notifications (recipient_id, type, created_at);

CREATE TABLE notification_type_settings (
    type            VARCHAR(40) PRIMARY KEY,
    in_app_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
    email_enabled   BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by_id   BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    -- Tắt trên hệ thống thì không gửi email (thư nói về thứ không có trên hệ thống).
    CONSTRAINT ck_notification_type_email_needs_in_app CHECK (in_app_enabled OR NOT email_enabled)
);

INSERT INTO notification_type_settings (type, in_app_enabled, email_enabled) VALUES
    ('VOUCHER_PENDING', TRUE, TRUE),
    ('VOUCHER_RESULT', TRUE, TRUE),
    ('INVENTORY_CAMPAIGN', TRUE, TRUE),
    ('YEAR_PROFILE', TRUE, TRUE),
    ('SYSTEM_ALERT', TRUE, TRUE),
    ('ADMIN_MESSAGE', TRUE, FALSE);

-- Chỉ lưu khi người dùng chọn KHÁC mặc định của loại.
CREATE TABLE notification_preferences (
    user_id        BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type           VARCHAR(40) NOT NULL REFERENCES notification_type_settings (type) ON DELETE CASCADE,
    email_enabled  BOOLEAN     NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, type)
);

CREATE TABLE notification_emails (
    id               BIGSERIAL PRIMARY KEY,
    notification_id  BIGINT       NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    recipient_email  VARCHAR(254),
    -- PENDING đang gửi; SENT; FAILED (thử lại tối đa 2 lần); SKIPPED (không gửi — lý do ở error).
    status           VARCHAR(20)  NOT NULL,
    attempts         INT          NOT NULL DEFAULT 0,
    error            VARCHAR(500),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    sent_at          TIMESTAMPTZ,
    CONSTRAINT uq_notification_emails_notification UNIQUE (notification_id),
    CONSTRAINT ck_notification_emails_status CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED'))
);
CREATE INDEX idx_notification_emails_retry ON notification_emails (status, created_at) WHERE status = 'FAILED';

INSERT INTO permissions (code, name, description, system_permission, scope) VALUES
    ('notification_type_settings:read', 'Xem cài đặt thông báo hệ thống',
     'Xem loại thông báo nào được gửi trên hệ thống, qua email', TRUE, 'SYSTEM'),
    ('notification_type_settings:write', 'Sửa cài đặt thông báo hệ thống',
     'Bật / tắt từng loại thông báo trên hệ thống, qua email; gửi thư thử', TRUE, 'SYSTEM');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN' AND p.code IN ('notification_type_settings:read', 'notification_type_settings:write')
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'notification_type_settings:%');
--rollback DELETE FROM permissions WHERE code LIKE 'notification_type_settings:%';
--rollback DROP TABLE notification_emails;
--rollback DROP TABLE notification_preferences;
--rollback DROP TABLE notification_type_settings;
--rollback ALTER TABLE notifications DROP COLUMN type;
