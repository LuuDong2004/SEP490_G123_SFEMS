--liquibase formatted sql

--changeset dth:063-p8-data-transfer
--comment P8 — nhập dữ liệu hàng loạt và xuất toàn bộ dữ liệu. Ba mã quyền trên tài nguyên data_transfer: read (xem màn, tải mẫu), write (nhập — vào trường mình, qua đúng service và phạm vi dòng như khi tạo tay), export (xuất toàn bộ dữ liệu trong phạm vi, có ghi nhật ký).

INSERT INTO permissions (code, name, description, system_permission)
SELECT v.code, v.name, v.description, TRUE
FROM (VALUES
    ('data_transfer:read',   'Xem nhập / xuất dữ liệu', 'Mở màn nhập / xuất dữ liệu, tải tệp mẫu'),
    ('data_transfer:write',  'Nhập dữ liệu hàng loạt',  'Nhập hồ sơ tài sản, cán bộ từ tệp Excel / CSV'),
    ('data_transfer:export', 'Xuất toàn bộ dữ liệu',    'Xuất toàn bộ dữ liệu nghiệp vụ trong phạm vi ra tệp .zip')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

WITH grant_map(role_code, code) AS (VALUES
    ('ADMIN', 'data_transfer:read'), ('ADMIN', 'data_transfer:write'), ('ADMIN', 'data_transfer:export'),
    ('SCHOOL_STAFF', 'data_transfer:read'), ('SCHOOL_STAFF', 'data_transfer:write'),
    ('SCHOOL_ADMIN', 'data_transfer:read'), ('SCHOOL_ADMIN', 'data_transfer:write'),
    ('SCHOOL_LEADER', 'data_transfer:read'), ('SCHOOL_LEADER', 'data_transfer:export'),
    ('UBND_LEADER', 'data_transfer:read'), ('UBND_LEADER', 'data_transfer:export'),
    ('SO_LEADER', 'data_transfer:read'), ('SO_LEADER', 'data_transfer:export')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM grant_map g JOIN roles r ON r.code = g.role_code JOIN permissions p ON p.code = g.code
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
