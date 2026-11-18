--liquibase formatted sql

--changeset qltb:202-csvc-confirmation
-- Lãnh đạo đơn vị XÁC NHẬN hiện trạng CSVC (QLTB-639..641, HSDT TL4.1.4 mục 4.1): cán bộ khai / sửa phòng, hạng mục,
-- khối nhà → "Chờ xác nhận"; lãnh đạo (quyền rooms:approve / buildings:approve) xác nhận thành chính thức, hoặc trả lại
-- kèm lý do. Lãnh đạo tự khai / sửa thì chính thức luôn. Dữ liệu đã có trước là chính thức (không dồn việc cho lãnh đạo).
ALTER TABLE rooms
    ADD COLUMN confirm_status  VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
        CONSTRAINT ck_rooms_confirm_status CHECK (confirm_status IN ('PENDING', 'CONFIRMED', 'RETURNED')),
    ADD COLUMN confirmed_at    TIMESTAMP WITH TIME ZONE,
    ADD COLUMN confirmed_by_id BIGINT CONSTRAINT fk_rooms_confirmed_by REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN return_reason   VARCHAR(500);
CREATE INDEX idx_rooms_confirm_pending ON rooms (school_id) WHERE confirm_status <> 'CONFIRMED';

ALTER TABLE buildings
    ADD COLUMN confirm_status  VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
        CONSTRAINT ck_buildings_confirm_status CHECK (confirm_status IN ('PENDING', 'CONFIRMED', 'RETURNED')),
    ADD COLUMN confirmed_at    TIMESTAMP WITH TIME ZONE,
    ADD COLUMN confirmed_by_id BIGINT CONSTRAINT fk_buildings_confirmed_by REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN return_reason   VARCHAR(500);
CREATE INDEX idx_buildings_confirm_pending ON buildings (school_id) WHERE confirm_status <> 'CONFIRMED';

--rollback ALTER TABLE buildings DROP COLUMN confirm_status, DROP COLUMN confirmed_at, DROP COLUMN confirmed_by_id, DROP COLUMN return_reason;
--rollback ALTER TABLE rooms DROP COLUMN confirm_status, DROP COLUMN confirmed_at, DROP COLUMN confirmed_by_id, DROP COLUMN return_reason;

--changeset qltb:202-csvc-confirmation-permissions
INSERT INTO permissions (code, name, description, system_permission) VALUES
    ('rooms:approve',     'Xác nhận phòng, hạng mục CSVC', 'Xác nhận hoặc trả lại hiện trạng phòng, hạng mục CSVC đã khai', TRUE),
    ('buildings:approve', 'Xác nhận khối nhà',             'Xác nhận hoặc trả lại hiện trạng khối nhà đã khai',             TRUE);

-- Lãnh đạo trường và quản trị.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('rooms:approve', 'buildings:approve')
WHERE r.code IN ('SCHOOL_LEADER', 'ADMIN');

--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('rooms:approve', 'buildings:approve'));
--rollback DELETE FROM permissions WHERE code IN ('rooms:approve', 'buildings:approve');
