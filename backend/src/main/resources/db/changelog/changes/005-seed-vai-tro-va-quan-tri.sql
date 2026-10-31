--liquibase formatted sql

--changeset luudong:005-seed-vai-tro-va-quan-tri
--comment Năm vai trò theo năm tác nhân của Báo cáo 3 (mục 4.1) và quyền phần Hệ thống theo ma trận quyền (mục 4.4): QTV toàn quyền; Lãnh đạo Sở, Chuyên viên Sở chỉ xem tài khoản, vai trò, quyền; Lãnh đạo trường, Cán bộ thiết bị trường không có quyền phần này. Quyền nghiệp vụ của từng vai trò do người phụ trách mảng gán thêm.
INSERT INTO roles (code, name, description, system_role) VALUES
  ('ADMIN',         'Quản trị viên hệ thống', 'Quản lý tài khoản, vai trò, quyền và danh mục dùng chung',           TRUE),
  ('SO_LEADER',     'Lãnh đạo Sở',            'Duyệt đề xuất mua sắm cấp Sở và kế hoạch mua sắm',                   TRUE),
  ('SO_SPECIALIST', 'Chuyên viên Sở',         'Lập kế hoạch mua sắm, phát động kiểm kê, quản lý danh mục và trường', TRUE),
  ('SCHOOL_LEADER', 'Lãnh đạo trường',        'Duyệt đề xuất mua sắm, phiếu nhập và biên bản kiểm kê của trường',   TRUE),
  ('SCHOOL_STAFF',  'Cán bộ thiết bị trường', 'Quản lý hồ sơ thiết bị, lập đề xuất, phiếu nhập và phiếu kiểm kê',   TRUE);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('users:read', 'roles:read', 'permissions:read')
WHERE r.code IN ('SO_LEADER', 'SO_SPECIALIST');

-- Tài khoản quản trị đầu tiên: admin / Admin@123 (BCrypt). Mật khẩu này công khai: DemoAccountGuard khoá
-- tài khoản còn mật khẩu seed khi chạy bản chính thức (APP_STACK=sfems_main), nên phải đổi trước khi triển khai.
INSERT INTO users (username, email, password_hash, full_name, status, created_at) VALUES
  ('admin', 'admin@sfems.local', '$2a$10$ff7CTQvwMv0Szb.qGXF3zeMUkV8Jjta52A6kYzGDeZY4YE2pyd.YS',
   'Quản trị viên hệ thống', 'ACTIVE', TIMESTAMP WITH TIME ZONE '2026-10-31 00:00:00+07');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'ADMIN'
WHERE u.username = 'admin';
