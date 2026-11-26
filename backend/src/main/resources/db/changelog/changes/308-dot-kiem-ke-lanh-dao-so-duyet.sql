--liquibase formatted sql

--changeset luudong:308-dot-kiem-ke-lanh-dao-so-duyet
--comment Đợt kiểm kê qua Lãnh đạo Sở duyệt: chuyên viên lập nháp rồi trình; lãnh đạo duyệt thì đợt mới tới các trường, trả lại (kèm lý do) thì về nháp. Đợt đã có trước được coi là đã duyệt.
ALTER TABLE inventory_campaigns
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN approval_note VARCHAR(500),
    ADD COLUMN submitted_at TIMESTAMPTZ,
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN approved_by_id BIGINT REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE inventory_campaigns ALTER COLUMN status SET DEFAULT 'DRAFT';
ALTER TABLE inventory_campaigns ADD CONSTRAINT ck_inventory_campaigns_status CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED'));
CREATE INDEX idx_inventory_campaigns_status ON inventory_campaigns (status);

INSERT INTO permissions (code, name, description, system_permission)
SELECT 'inventory_campaigns:approve', 'Duyệt đợt kiểm kê', 'Duyệt, trả lại đợt kiểm kê chuyên viên trình', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'inventory_campaigns:approve');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'inventory_campaigns:approve'
WHERE r.code = 'SO_LEADER'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'inventory_campaigns:approve');
--rollback DELETE FROM permissions WHERE code = 'inventory_campaigns:approve';
--rollback ALTER TABLE inventory_campaigns DROP CONSTRAINT ck_inventory_campaigns_status, DROP COLUMN status, DROP COLUMN approval_note, DROP COLUMN submitted_at, DROP COLUMN approved_at, DROP COLUMN approved_by_id;
