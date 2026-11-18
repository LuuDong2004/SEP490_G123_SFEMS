--liquibase formatted sql

--changeset qltb:243-school-staff-room-delete
-- Cán bộ thiết bị toàn quyền với dữ liệu CSVC của trường (trưởng nhóm 12/11/2026) — thêm nhầm phòng thì phải xoá
-- được (M2-10, 13/11/2026). Cấp `rooms:delete` cho SCHOOL_STAFF kèm chính sách phạm vi dòng `delete` chép đúng
-- phạm vi `write` của vai đó (quên chính sách = có nút mà bấm là 422). Máy chủ vẫn chặn xoá phòng còn thiết bị,
-- lớp, kế hoạch bảo trì, lịch sử sửa chữa, phiếu kiểm kê (`RoomService.beforeDelete`).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'SCHOOL_STAFF' AND p.code = 'rooms:delete'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO row_level_policy (kind, role_id, resource, action, name, policy_group, description, scope, check_scope, enabled, created_at)
SELECT w.kind, w.role_id, w.resource, 'delete', w.name, w.policy_group, w.description, w.scope, w.check_scope, w.enabled, now()
FROM row_level_policy w
JOIN roles r ON r.id = w.role_id AND r.code = 'SCHOOL_STAFF'
WHERE w.resource = 'rooms' AND w.action = 'write' AND w.kind = 'SCOPE'
  AND NOT EXISTS (SELECT 1 FROM row_level_policy x
                  WHERE x.role_id = w.role_id AND x.resource = 'rooms' AND x.action = 'delete' AND x.kind = 'SCOPE');

--rollback DELETE FROM row_level_policy_audit WHERE policy_id IN (SELECT p.id FROM row_level_policy p JOIN roles r ON r.id = p.role_id WHERE r.code = 'SCHOOL_STAFF' AND p.resource = 'rooms' AND p.action = 'delete');
--rollback DELETE FROM row_level_policy p USING roles r WHERE r.id = p.role_id AND r.code = 'SCHOOL_STAFF' AND p.resource = 'rooms' AND p.action = 'delete';
--rollback DELETE FROM role_permissions rp USING roles r, permissions p WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = 'SCHOOL_STAFF' AND p.code = 'rooms:delete';
