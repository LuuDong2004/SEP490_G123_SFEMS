--liquibase formatted sql

--changeset dth:066-p9-system-status
--comment P9 — màn tình trạng vận hành và sao lưu, chỉ quản trị viên.

INSERT INTO permissions (code, name, description, system_permission)
SELECT v.code, v.name, v.description, TRUE
FROM (VALUES
    ('system_status:read',  'Xem tình trạng hệ thống', 'Dung lượng, ổ đĩa, sao lưu, cảnh báo vận hành'),
    ('system_status:write', 'Chạy sao lưu',            'Chạy sao lưu cơ sở dữ liệu ngay')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code LIKE 'system_status:%'
WHERE r.code = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
