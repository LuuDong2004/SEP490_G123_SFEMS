--liquibase formatted sql

--changeset qltb:235-role-type-permission-scope splitStatements:false
-- Vai và quyền có loại (docs/kien-truc/11 §11, theo RoleType / PermissionScope của qlvb-app):
--   roles.role_type     vai dùng cho loại tài khoản nào: SYSTEM / SO / UBND / SCHOOL — cố định từ lúc tạo
--   permissions.scope   SYSTEM (chỉ quản trị) / ORGANIZATION (nghiệp vụ của đơn vị) / COMMON (mọi loại)
-- Vai quản trị chỉ mang quyền SYSTEM + COMMON; vai Sở / UBND / trường chỉ mang ORGANIZATION + COMMON; tài khoản chỉ
-- mang vai đúng loại của mình. CSDL giữ cả ba luật bằng trigger. Quyền chép theo bảng cổng (PortalRoutes): tài nguyên
-- chỉ cổng Admin mở → SYSTEM; cổng Admin và cổng nghiệp vụ cùng mở → COMMON; còn lại ORGANIZATION.

-- 1. Phạm vi của quyền. Quyền seed về sau mặc định là nghiệp vụ; quyền quản trị mới phải ghi rõ SYSTEM
--    (PermissionScopeTest so với PortalRoutes).
ALTER TABLE permissions ADD COLUMN scope VARCHAR(16) NOT NULL DEFAULT 'ORGANIZATION';
UPDATE permissions SET scope = CASE
    WHEN split_part(code, ':', 1) IN ('users', 'roles', 'permissions', 'row_level_policies', 'approval_flows',
                                      'integrations', 'ai_settings', 'data_changes', 'system_status', 'api_clients',
                                      'activity_logs')
        OR code IN ('code_rules:write', 'code_rules:delete') THEN 'SYSTEM'
    WHEN split_part(code, ':', 1) = 'notifications'
        OR code IN ('code_rules:read', 'code_rules:export')
        OR (split_part(code, ':', 1) IN ('schools', 'departments_of_education', 'wards', 'education_levels',
                                         'school_types')
            AND split_part(code, ':', 2) IN ('read', 'export')) THEN 'COMMON'
    ELSE 'ORGANIZATION'
END;
ALTER TABLE permissions
    ADD CONSTRAINT ck_permissions_scope CHECK (scope IN ('SYSTEM', 'ORGANIZATION', 'COMMON'));

-- 2. Loại của vai. Vai hệ thống theo mã; vai tự tạo theo loại của người đang giữ.
ALTER TABLE roles ADD COLUMN role_type VARCHAR(16);
UPDATE roles SET role_type = CASE
    WHEN code = 'ADMIN' THEN 'SYSTEM'
    WHEN code LIKE 'SO\_%' THEN 'SO'
    WHEN code LIKE 'UBND\_%' THEN 'UBND'
    WHEN code LIKE 'SCHOOL\_%' THEN 'SCHOOL'
END
WHERE system_role;

DO $$
DECLARE
    r        RECORD;
    t        TEXT;
    clone_id BIGINT;
BEGIN
    FOR r IN
        SELECT ro.id, ro.code, ro.name, ro.description,
               (SELECT array_agg(DISTINCT u.user_type ORDER BY u.user_type)
                FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role_id = ro.id) AS types,
               (SELECT count(*) FILTER (WHERE p.scope = 'SYSTEM') - count(*) FILTER (WHERE p.scope = 'ORGANIZATION')
                FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = ro.id) AS system_lean
        FROM roles ro
        WHERE ro.role_type IS NULL
    LOOP
        IF r.types IS NULL THEN
            -- Chưa ai giữ: đoán theo mã, rồi theo quyền đang mang.
            UPDATE roles SET role_type = CASE
                WHEN r.code LIKE 'SO\_%' THEN 'SO'
                WHEN r.code LIKE 'UBND\_%' THEN 'UBND'
                WHEN r.system_lean > 0 THEN 'SYSTEM'
                ELSE 'SCHOOL'
            END WHERE id = r.id;
        ELSE
            UPDATE roles SET role_type = r.types[1] WHERE id = r.id;
            -- Người của nhiều loại cùng giữ: mỗi loại thêm một bản sao của vai, chuyển người sang bản sao đó.
            -- Chính sách phạm vi dòng không chép — người được chuyển không thấy dữ liệu cho tới khi quản trị gán lại.
            FOREACH t IN ARRAY r.types[2:] LOOP
                INSERT INTO roles (code, name, description, system_role, role_type)
                VALUES (left(r.code || '_' || t, 64), left(r.name || ' (' || t || ')', 255), r.description, FALSE, t)
                RETURNING id INTO clone_id;
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT clone_id, permission_id FROM role_permissions WHERE role_id = r.id;
                UPDATE user_roles ur SET role_id = clone_id
                FROM users u
                WHERE u.id = ur.user_id AND ur.role_id = r.id AND u.user_type = t;
                RAISE NOTICE '235: vai % có người loại % — tách sang %, cần gán lại phạm vi dòng',
                    r.code, t, left(r.code || '_' || t, 64);
            END LOOP;
        END IF;
    END LOOP;
END $$;

ALTER TABLE roles
    ALTER COLUMN role_type SET NOT NULL,
    ADD CONSTRAINT ck_roles_role_type CHECK (role_type IN ('SYSTEM', 'SO', 'UBND', 'SCHOOL'));

-- 3. Bỏ quyền sai loại khỏi vai: vai quản trị mất quyền nghiệp vụ (ADMIN từ 260 còn khoảng 50 mã), vai Sở / UBND /
--    trường mất quyền quản trị (vốn đã bị cổng chặn — chỉ còn làm hiện mục menu dẫn vào màn trả 403).
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE r.id = rp.role_id AND p.id = rp.permission_id
  AND ((r.role_type = 'SYSTEM' AND p.scope = 'ORGANIZATION')
       OR (r.role_type <> 'SYSTEM' AND p.scope = 'SYSTEM'));

-- 4. CSDL tự giữ luật.
CREATE FUNCTION role_permission_fits() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
    rt TEXT;
    ps TEXT;
BEGIN
    SELECT role_type INTO rt FROM roles WHERE id = NEW.role_id;
    SELECT scope INTO ps FROM permissions WHERE id = NEW.permission_id;
    IF (rt = 'SYSTEM' AND ps = 'ORGANIZATION') OR (rt <> 'SYSTEM' AND ps = 'SYSTEM') THEN
        RAISE EXCEPTION 'Quyền phạm vi % không gán được cho vai loại %', ps, rt USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $fn$;

CREATE TRIGGER trg_role_permission_fits
    BEFORE INSERT OR UPDATE ON role_permissions
    FOR EACH ROW EXECUTE FUNCTION role_permission_fits();

CREATE FUNCTION user_role_fits() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
    rt TEXT;
    ut TEXT;
BEGIN
    SELECT role_type INTO rt FROM roles WHERE id = NEW.role_id;
    SELECT user_type INTO ut FROM users WHERE id = NEW.user_id;
    IF rt IS DISTINCT FROM ut THEN
        RAISE EXCEPTION 'Vai loại % không gán được cho tài khoản loại %', rt, ut USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $fn$;

CREATE TRIGGER trg_user_role_fits
    BEFORE INSERT OR UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION user_role_fits();

CREATE FUNCTION role_type_fixed() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.role_type IS DISTINCT FROM OLD.role_type THEN
        RAISE EXCEPTION 'Không đổi được loại của vai %', OLD.code USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $fn$;

CREATE TRIGGER trg_role_type_fixed
    BEFORE UPDATE OF role_type ON roles
    FOR EACH ROW EXECUTE FUNCTION role_type_fixed();
