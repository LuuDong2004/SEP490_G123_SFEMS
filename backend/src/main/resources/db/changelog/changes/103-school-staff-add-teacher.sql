--liquibase formatted sql

--changeset qltb:103-school-staff-add-teacher
-- Cán bộ thiết bị thêm được giáo viên của trường mình từ tab Nhân sự.
--
-- Cấp mã quyền VÀ phạm vi dòng `write` cùng lúc (xem CLAUDE.md, mục 072): chỉ cấp mã thì
-- `@PreAuthorize` cho qua rồi máy chủ vẫn từ chối từng dòng. Phạm vi chép từ chính sách `write` của
-- lãnh đạo trường — điều kiện bó vào trường của tài khoản (`user.schoolId`).
--
-- Chỉ `staff:write`. KHÔNG cấp `staff:delete` và `staff_accounts:write`: xoá nhân sự và cấp tài khoản
-- đăng nhập vẫn là việc của lãnh đạo trường / Sở.

INSERT INTO row_level_policy (
    kind, role_id, resource, action, name, policy_group, description,
    scope, check_scope, enabled, created_at)
SELECT p.kind, staff_role.id, p.resource, p.action,
       p.name, p.policy_group,
       'Cán bộ thiết bị thêm, sửa nhân sự của trường mình.',
       p.scope, p.check_scope, p.enabled, now()
FROM row_level_policy p
JOIN roles leader ON leader.id = p.role_id AND leader.code = 'SCHOOL_LEADER'
CROSS JOIN roles staff_role
WHERE staff_role.code = 'SCHOOL_STAFF'
  AND p.resource = 'staff' AND p.action = 'write'
  AND NOT EXISTS (
      SELECT 1 FROM row_level_policy x
      WHERE x.role_id = staff_role.id AND x.resource = 'staff' AND x.action = 'write');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'SCHOOL_STAFF' AND p.code = 'staff:write'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
--rollback DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = 'SCHOOL_STAFF') AND permission_id = (SELECT id FROM permissions WHERE code = 'staff:write'); DELETE FROM row_level_policy_audit WHERE policy_id IN (SELECT id FROM row_level_policy WHERE role_id = (SELECT id FROM roles WHERE code = 'SCHOOL_STAFF') AND resource = 'staff' AND action = 'write'); DELETE FROM row_level_policy WHERE role_id = (SELECT id FROM roles WHERE code = 'SCHOOL_STAFF') AND resource = 'staff' AND action = 'write';
