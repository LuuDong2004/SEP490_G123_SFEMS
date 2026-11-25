--liquibase formatted sql

--changeset qltb:177-facility-works-no-delete
-- Sổ sửa chữa, cải tạo cơ sở vật chất là hồ sơ lưu, không xoá: thu `facility_works:delete` khỏi mọi vai.
-- Mã quyền và endpoint xoá vẫn còn, chỉ không vai nào giữ. Chính sách phạm vi dòng `delete` (chép từ
-- `rooms` ở 105) không còn gì để mở: gỡ chính sách rồi cấp quyền. Nhật ký chính sách GIỮ LẠI — nó không có
-- khoá ngoại tới `row_level_policy`, và là lịch sử ai đã cấp gì.
DELETE FROM row_level_policy
WHERE resource = 'facility_works' AND action = 'delete' AND kind = 'SCOPE';

DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id AND p.code = 'facility_works:delete';

--rollback INSERT INTO role_permissions (role_id, permission_id) SELECT rp.role_id, t.id FROM role_permissions rp JOIN permissions s ON s.id = rp.permission_id AND s.code = 'rooms:delete' JOIN permissions t ON t.code = 'facility_works:delete' ON CONFLICT DO NOTHING;
--rollback INSERT INTO row_level_policy (kind, role_id, resource, action, name, policy_group, description, scope, check_scope, enabled, created_at) SELECT kind, role_id, 'facility_works', action, name, policy_group, description, scope, check_scope, enabled, now() FROM row_level_policy WHERE resource = 'rooms' AND action = 'delete' AND kind = 'SCOPE';
