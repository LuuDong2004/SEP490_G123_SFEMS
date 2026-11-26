--liquibase formatted sql

--changeset luudong:303-lanh-dao-so-lap-ke-hoach
--comment Lãnh đạo Sở lập, sửa, xoá được kế hoạch mua sắm như chuyên viên Sở (vẫn duyệt kế hoạch, kể cả kế hoạch mình lập)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('procurement_plans:write', 'procurement_plans:delete')
WHERE r.code = 'SO_LEADER'
ON CONFLICT DO NOTHING;
--rollback DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = 'SO_LEADER') AND permission_id IN (SELECT id FROM permissions WHERE code IN ('procurement_plans:write', 'procurement_plans:delete'));
