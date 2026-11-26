--liquibase formatted sql

--changeset luudong:300-can-bo-sua-ma-cua-truong
--comment Cán bộ thiết bị của trường sửa được mã tự tăng của trường (ký hiệu, số chữ số, số bắt đầu), như lãnh đạo trường
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'school_code_rules:write'
WHERE r.code = 'SCHOOL_STAFF'
ON CONFLICT DO NOTHING;
--rollback DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = 'SCHOOL_STAFF') AND permission_id = (SELECT id FROM permissions WHERE code = 'school_code_rules:write');
