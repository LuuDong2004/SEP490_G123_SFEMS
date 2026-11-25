--liquibase formatted sql

--changeset luudong:281-quan-tri-vien-toan-quyen
--comment Quản trị viên đi được toàn bộ luồng (trưởng nhóm 20/11/2026): vai ADMIN có mọi mã quyền, kể cả quyền nghiệp vụ 272 đã thu (lập / duyệt / xoá phiếu, sửa thiết bị, phòng, nhập dữ liệu đầu vào). Cổng Admin ghi được dữ liệu nghiệp vụ (PortalRoutes).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
--rollback SELECT 1;
