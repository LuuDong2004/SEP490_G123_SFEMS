--liquibase formatted sql

--changeset luudong:254-can-bo-truong-nhap-du-lieu
--comment UC TS-07 (Nhập dữ liệu thiết bị ban đầu từ tệp) có tác nhân là Cán bộ thiết bị trường, nên cấp lại ba quyền data_imports cho vai trò này (đã bị gỡ ở 213). Chuyên viên Sở vẫn giữ quyền. Cán bộ thiết bị chỉ nhập vào trường của mình (VisibleSchools); khi ghi, từng dòng đi qua service của từng loại, và vai trò này đã có quyền cùng phạm vi ghi trên cơ sở, khối nhà, phòng, lớp, cán bộ, tổ bộ môn, thiết bị.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('data_imports:read', 'data_imports:write', 'data_imports:delete')
WHERE r.code = 'SCHOOL_STAFF'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
--rollback DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = 'SCHOOL_STAFF') AND permission_id IN (SELECT id FROM permissions WHERE code LIKE 'data_imports:%');
