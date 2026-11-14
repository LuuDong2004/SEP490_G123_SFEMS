--liquibase formatted sql

--changeset qltb:155-staff-leadership-permission
-- Bổ nhiệm / thôi giữ chức vụ lãnh đạo là quyền riêng, không gộp với quyền cấp tài khoản.
INSERT INTO permissions (code, name, description, system_permission)
VALUES ('staff:assign_leadership', 'Quản lý chức vụ lãnh đạo trường',
        'Đặt hoặc thay đổi chức vụ Hiệu trưởng, Phó hiệu trưởng trên hồ sơ nhân viên', TRUE);

-- Giữ nguyên những vai vốn được phép làm việc này, không cấp thêm cho cán bộ thiết bị.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT old_grant.role_id, new_permission.id
FROM role_permissions old_grant
JOIN permissions old_permission ON old_permission.id = old_grant.permission_id
    AND old_permission.code = 'staff_accounts:write'
CROSS JOIN permissions new_permission
WHERE new_permission.code = 'staff:assign_leadership';

--rollback DELETE FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE code = 'staff:assign_leadership');
--rollback DELETE FROM permissions WHERE code = 'staff:assign_leadership';
