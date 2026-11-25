--liquibase formatted sql

--changeset dth:062-p7-reports
--comment P7 — bảng điều khiển và bộ báo cáo: hai mã quyền reports:read, reports:export. Báo cáo không có dữ liệu riêng — nó gộp dữ liệu các nghiệp vụ trên phạm vi trường của người xem — nên không có phạm vi dòng nào để seed.

INSERT INTO permissions (code, name, description, system_permission)
SELECT v.code, v.name, v.description, TRUE
FROM (VALUES
    ('reports:read',   'Xem báo cáo',  'Xem bảng điều khiển và các báo cáo tổng hợp trong phạm vi của mình'),
    ('reports:export', 'Xuất báo cáo', 'Xuất báo cáo ra tệp Excel — mỗi lần xuất được ghi nhật ký')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

WITH grant_map(role_code, code) AS (VALUES
    ('ADMIN', 'reports:read'), ('ADMIN', 'reports:export'),
    ('SO_LEADER', 'reports:read'), ('SO_LEADER', 'reports:export'),
    ('SO_SPECIALIST', 'reports:read'), ('SO_SPECIALIST', 'reports:export'),
    ('UBND_LEADER', 'reports:read'), ('UBND_LEADER', 'reports:export'),
    ('UBND_SPECIALIST', 'reports:read'), ('UBND_SPECIALIST', 'reports:export'),
    ('SCHOOL_LEADER', 'reports:read'), ('SCHOOL_LEADER', 'reports:export'),
    ('SCHOOL_STAFF', 'reports:read'), ('SCHOOL_STAFF', 'reports:export'),
    ('SCHOOL_ADMIN', 'reports:read')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM grant_map g JOIN roles r ON r.code = g.role_code JOIN permissions p ON p.code = g.code
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
