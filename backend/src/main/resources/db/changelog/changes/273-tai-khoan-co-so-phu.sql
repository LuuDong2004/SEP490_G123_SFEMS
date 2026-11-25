--liquibase formatted sql

--changeset luudong:273-tai-khoan-co-so-phu
--comment Tài khoản dùng thử thcs.canbo2: cán bộ thiết bị THCS Bình An chỉ ở cơ sở phụ, để thử phạm vi theo cơ sở (270). Nút "CB CS phụ" ở màn đăng nhập trỏ tới tài khoản này nhưng trước đây chưa có seed. Cùng mật khẩu, cùng vai với thcs.canbo; trường chưa có cơ sở phụ thì để trống (cả trường).
INSERT INTO users (username, email, password_hash, full_name, status, created_at, password_changed_at, user_type)
SELECT 'thcs.canbo2', 'thcs.canbo2@demo.sfems.vn', u.password_hash, 'Cán bộ cơ sở phụ (demo)', 'ACTIVE', now(), now(), 'SCHOOL'
FROM users u
WHERE u.username = 'thcs.canbo' AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'thcs.canbo2');

INSERT INTO user_schools (id, school_id, position, campus_id)
SELECT n.id, us.school_id, 'STAFF',
       (SELECT c.id FROM campuses c WHERE c.school_id = us.school_id
          AND (SELECT COUNT(*) FROM campuses x WHERE x.school_id = us.school_id) > 1
        ORDER BY c.id DESC LIMIT 1)
FROM users n, users o JOIN user_schools us ON us.id = o.id
WHERE n.username = 'thcs.canbo2' AND o.username = 'thcs.canbo'
  AND NOT EXISTS (SELECT 1 FROM user_schools WHERE id = n.id);

INSERT INTO user_roles (user_id, role_id)
SELECT n.id, ur.role_id
FROM users n, users o JOIN user_roles ur ON ur.user_id = o.id
WHERE n.username = 'thcs.canbo2' AND o.username = 'thcs.canbo'
ON CONFLICT DO NOTHING;
--rollback DELETE FROM user_roles WHERE user_id = (SELECT id FROM users WHERE username = 'thcs.canbo2'); DELETE FROM user_schools WHERE id = (SELECT id FROM users WHERE username = 'thcs.canbo2'); DELETE FROM users WHERE username = 'thcs.canbo2';
