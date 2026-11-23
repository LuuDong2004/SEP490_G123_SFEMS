--liquibase formatted sql

--changeset qltb:237-admin-full-access splitStatements:false
-- Quản trị dùng được TOÀN BỘ chức năng như trước (theo trưởng nhóm, 12/11/2026; docs/kien-truc/11 §11): vai loại
-- SYSTEM mang được cả quyền nghiệp vụ (ORGANIZATION). Chiều ngược lại giữ nguyên: vai Sở / UBND / trường không mang
-- quyền quản trị (SYSTEM). Cổng Admin mở mọi tài nguyên (PortalRoutes). Phạm vi dữ liệu của ADMIN vẫn là chính sách
-- phạm vi dòng của vai (80 chính sách, không đổi); ở CSDL quản trị thuộc chế độ ALL.

CREATE OR REPLACE FUNCTION role_permission_fits() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
    rt TEXT;
    ps TEXT;
BEGIN
    SELECT role_type INTO rt FROM roles WHERE id = NEW.role_id;
    SELECT scope INTO ps FROM permissions WHERE id = NEW.permission_id;
    IF rt <> 'SYSTEM' AND ps = 'SYSTEM' THEN
        RAISE EXCEPTION 'Quyền phạm vi % không gán được cho vai loại %', ps, rt USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $fn$;

-- Trả lại cho ADMIN mọi quyền (235 đã bỏ phần nghiệp vụ).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
