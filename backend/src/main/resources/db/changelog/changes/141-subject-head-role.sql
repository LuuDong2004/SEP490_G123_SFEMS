--liquibase formatted sql

--changeset qltb:141-subject-head-role
-- Vai Trưởng bộ môn (QLTB-488). Theo BA: như Cán bộ thiết bị, chỉ KHÔNG ghi tăng và KHÔNG đề xuất mua
-- sắm — vẫn lập phiếu cấp phát, sửa chữa, báo hỏng, mượn trả như cán bộ thiết bị, và vẫn xem được phiếu
-- ghi tăng, đề xuất mua sắm của trường.
--
-- Chép từ SCHOOL_STAFF thay vì liệt kê tay, cả mã quyền LẪN phạm vi dòng (xem CLAUDE.md, mục 072: cấp mã
-- mà quên phạm vi dòng thì `@PreAuthorize` cho qua rồi máy chủ vẫn từ chối từng dòng). Bỏ đúng bốn mã
-- `equipment_intakes:write/delete`, `purchase_proposals:write/delete` và phạm vi dòng `write` / `delete`
-- của hai tài nguyên đó.

INSERT INTO roles (code, name, description, system_role)
SELECT 'SUBJECT_HEAD', 'Trưởng bộ môn',
       'Lập phiếu cấp phát, sửa chữa, báo hỏng, mượn trả của trường mình như cán bộ thiết bị; không ghi tăng, không đề xuất mua sắm.',
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'SUBJECT_HEAD');

INSERT INTO role_permissions (role_id, permission_id)
SELECT head.id, rp.permission_id
FROM roles head
JOIN roles staff ON staff.code = 'SCHOOL_STAFF'
JOIN role_permissions rp ON rp.role_id = staff.id
JOIN permissions p ON p.id = rp.permission_id
WHERE head.code = 'SUBJECT_HEAD'
  AND p.code NOT IN ('equipment_intakes:write', 'equipment_intakes:delete',
                     'purchase_proposals:write', 'purchase_proposals:delete')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions x WHERE x.role_id = head.id AND x.permission_id = rp.permission_id);

INSERT INTO row_level_policy (
    kind, role_id, resource, action, name, policy_group, description,
    scope, check_scope, enabled, created_at)
SELECT p.kind, head.id, p.resource, p.action,
       p.name, p.policy_group, p.description,
       p.scope, p.check_scope, p.enabled, now()
FROM row_level_policy p
JOIN roles staff ON staff.id = p.role_id AND staff.code = 'SCHOOL_STAFF'
CROSS JOIN roles head
WHERE head.code = 'SUBJECT_HEAD'
  AND NOT (p.resource IN ('equipment_intakes', 'purchase_proposals') AND p.action IN ('write', 'delete'))
  AND NOT EXISTS (
      SELECT 1 FROM row_level_policy x
      WHERE x.role_id = head.id AND x.resource = p.resource AND x.action = p.action AND x.name = p.name);
--rollback DELETE FROM row_level_policy_audit WHERE policy_id IN (SELECT id FROM row_level_policy WHERE role_id = (SELECT id FROM roles WHERE code = 'SUBJECT_HEAD')); DELETE FROM row_level_policy WHERE role_id = (SELECT id FROM roles WHERE code = 'SUBJECT_HEAD'); DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = 'SUBJECT_HEAD'); DELETE FROM roles WHERE code = 'SUBJECT_HEAD';
