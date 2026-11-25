--liquibase formatted sql

-- Chuyên viên UBND sửa được hồ sơ trường trên địa bàn của mình.
--
-- Trước changelog này chỉ LÃNH ĐẠO UBND có `schools:write`, còn chuyên viên UBND thì không — ngược với
-- vai trò trong `docs/phantich/00-actor-va-phan-quyen.md` (chuyên viên là người làm, lãnh đạo là người
-- duyệt) và ngược với phía Sở, nơi chuyên viên Sở sửa được trường Sở quản lý. Quyền của lãnh đạo giữ
-- nguyên: bớt quyền của một vai đang dùng là việc phải hỏi riêng.
--
-- Cấp mã quyền thì phải cấp KÈM phạm vi ghi, nếu không `@PreAuthorize` cho qua rồi máy chủ từ chối từng
-- dòng. Phạm vi chép đúng từ chính sách ghi của lãnh đạo UBND: chỉ trường mà cơ quan chủ quản là cơ quan
-- của người đang đăng nhập.

--changeset qltb:119-ubnd-specialist-edits-schools
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'schools:write'
WHERE r.code = 'UBND_SPECIALIST'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO row_level_policy (kind, role_id, resource, action, name, policy_group, description, scope, check_scope, enabled, created_at)
SELECT p.kind, specialist.id, p.resource, p.action, p.name, p.policy_group, p.description, p.scope, p.check_scope, TRUE, NOW()
FROM row_level_policy p
JOIN roles leader ON leader.id = p.role_id AND leader.code = 'UBND_LEADER'
JOIN roles specialist ON specialist.code = 'UBND_SPECIALIST'
WHERE p.resource = 'schools' AND p.action = 'write' AND p.enabled
  AND NOT EXISTS (SELECT 1 FROM row_level_policy x
                  WHERE x.role_id = specialist.id AND x.resource = 'schools' AND x.action = 'write');
