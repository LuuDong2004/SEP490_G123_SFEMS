--liquibase formatted sql

-- Quản trị tài khoản DƯỚI CẤP TRƯỜNG cho lãnh đạo trường: màn "Tài khoản của trường",
-- /api/school_users (SchoolUserService). Mã quyền riêng school_users:* chứ không phải users:* —
-- users:write sửa được mọi tài khoản của mọi trường (bảng users không có phạm vi dòng, CLAUDE.md
-- mục 072). Lối này tự khoá vào trường của người gọi và chỉ chạm tới / chỉ gán ba vai phía trường.

--changeset qltb:092-school-users
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('school_users:read',   'Xem tài khoản của trường', 'Xem tài khoản đăng nhập của cán bộ, giáo viên trong trường', TRUE),
  ('school_users:write',  'Sửa tài khoản của trường', 'Thêm, sửa, đặt lại mật khẩu, khoá tài khoản trong trường (chỉ vai phía trường)', TRUE),
  ('school_users:delete', 'Xoá tài khoản của trường', 'Xoá tài khoản đăng nhập trong trường', TRUE);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('school_users:read', 'school_users:write', 'school_users:delete')
WHERE r.code = 'SCHOOL_LEADER';
--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'school_users:%'); DELETE FROM permissions WHERE code LIKE 'school_users:%';
