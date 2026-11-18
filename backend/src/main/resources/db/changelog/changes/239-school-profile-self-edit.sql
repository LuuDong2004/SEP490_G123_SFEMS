--liquibase formatted sql

--changeset qltb:239-school-profile-self-edit
-- Trường tự sửa phần hồ sơ của CHÍNH MÌNH (trưởng nhóm chốt 12/11/2026): ảnh, địa chỉ, mã định danh Bộ GD&ĐT.
-- Lối hẹp `school_profile:write` (`/api/school_profile`, trường lấy từ người gọi), không cấp `schools:write`: các ô
-- còn lại của hồ sơ trường — tên, mã trường, mã hai ký tự, cấp học, loại hình, phường, cơ quan quản lý, trạng thái —
-- quyết định phạm vi dữ liệu và mã tài sản nên vẫn chỉ UBND / Sở sửa. Cán bộ thiết bị toàn quyền dữ liệu của trường
-- nên được cấp cùng lãnh đạo trường; ADMIN cũng mang (quyền mới không tự có).
INSERT INTO permissions (code, name, description, system_permission, scope)
VALUES ('school_profile:write', 'Sửa hồ sơ trường mình',
        'Sửa ảnh, địa chỉ, mã định danh Bộ GD&ĐT của trường mình', TRUE, 'ORGANIZATION');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('SCHOOL_STAFF', 'SCHOOL_LEADER', 'ADMIN')
  AND p.code = 'school_profile:write'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
--rollback DELETE FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE code = 'school_profile:write');
--rollback DELETE FROM permissions WHERE code = 'school_profile:write';
