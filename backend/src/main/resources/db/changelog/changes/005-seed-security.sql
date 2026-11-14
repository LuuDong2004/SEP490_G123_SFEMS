--liquibase formatted sql

--changeset dth:005-seed-security
--comment Permissions, the three system roles that bundle them, and the accounts needed to sign in for the first time.

-- Permission codes are "resource:action", where the resource half is the same
-- name the frontend declares in routes.tsx. That is what lets the access
-- control provider derive the code it has to ask for from the resource and
-- action it is already given, instead of carrying a hand-written mapping.
INSERT INTO permissions (code, name, description) VALUES
  ('users:read',        'View users',            'List and open user accounts'),
  ('users:write',       'Create and edit users', 'Create accounts, edit them, assign roles and reset passwords'),
  ('users:delete',      'Delete users',          'Permanently remove a user account'),
  ('roles:read',        'View roles',            'List and open roles and the permissions they grant'),
  ('roles:write',       'Create and edit roles', 'Create roles and change the permissions they grant'),
  ('roles:delete',      'Delete roles',          'Permanently remove a role'),
  ('permissions:read',  'View permissions',      'Read the permission catalogue');

-- All three are system roles: the API refuses to delete them or change their
-- code, because ADMIN losing its grants would leave nobody able to restore it.
INSERT INTO roles (code, name, description, system_role) VALUES
  ('ADMIN',   'Administrator', 'Full access to every part of the system, including users and roles.', TRUE),
  ('MANAGER', 'Manager',       'Manages all content and can see, but not change, users and roles.',   TRUE),
  ('USER',    'User',          'Read-only access to content.',                                        TRUE);

-- Roles and permissions are joined by code rather than by a hardcoded id: both
-- id columns are identities, so pinning ids here would leave their sequences
-- behind and the first insert from the application would collide.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON TRUE
WHERE r.code = 'ADMIN';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('users:read', 'roles:read', 'permissions:read')
WHERE r.code = 'MANAGER';

-- USER không nhận mã quyền nào ở bước này: hai resource demo (blog_posts,
-- categories) đã bị gỡ và chưa có resource nghiệp vụ nào thay thế. Quyền cho
-- USER được cấp ở 007 (notifications), 010 (organizations) và 014 (tasks).
-- Một danh sách IN rỗng là SQL không hợp lệ, nên câu lệnh được bỏ hẳn
-- thay vì để lại rỗng.
--
-- Lưu ý: trong file formatted SQL, KHÔNG được mở một dòng chú thích bằng từ
-- "changeset" -- Liquibase bắt nó như khai báo changeset và bỏ cả file.

-- Seed accounts. The hashes below are BCrypt of Admin@123, Manager@123 and
-- User@123 respectively — development credentials, and the first thing to
-- change on any deployment that is reachable by anyone else.
INSERT INTO users (username, email, password_hash, full_name, status, created_at) VALUES
  ('admin',   'admin@dth.local',   '$2a$10$ff7CTQvwMv0Szb.qGXF3zeMUkV8Jjta52A6kYzGDeZY4YE2pyd.YS', 'System Administrator', 'ACTIVE', TIMESTAMP WITH TIME ZONE '2024-01-01 00:00:00+00'),
  ('manager', 'manager@dth.local', '$2a$10$V8oIo7huVUFIboiHBSg3puQFWhtmf9hl1iLE.ShTbCl9w4f9sHdxW', 'Content Manager',      'ACTIVE', TIMESTAMP WITH TIME ZONE '2024-01-01 00:00:00+00'),
  ('viewer',  'viewer@dth.local',  '$2a$10$VAqCXeceitJBv.F3pGGwcehpaeGKP2.nyTe.5lFwfbmqPCS8hLSTm', 'Read-only Viewer',     'ACTIVE', TIMESTAMP WITH TIME ZONE '2024-01-01 00:00:00+00');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM (VALUES
  ('admin',   'ADMIN'),
  ('manager', 'MANAGER'),
  ('viewer',  'USER')
) AS v(username, role_code)
JOIN users u ON u.username = v.username
JOIN roles r ON r.code = v.role_code;

--rollback DELETE FROM user_roles;
--rollback DELETE FROM users;
--rollback DELETE FROM role_permissions;
--rollback DELETE FROM roles;
--rollback DELETE FROM permissions;
