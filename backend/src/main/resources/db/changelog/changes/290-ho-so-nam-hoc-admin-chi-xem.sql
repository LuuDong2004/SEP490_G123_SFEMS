--liquibase formatted sql

--changeset luudong:290-ho-so-nam-hoc-admin-chi-xem splitStatements:false
-- 290: Hồ sơ năm học — quản trị viên chỉ xem (trưởng nhóm 24/11/2026). Bỏ quyền ghi, mở lại của vai loại SYSTEM và thêm
-- school_year_profiles vào danh sách dữ liệu nghiệp vụ của trigger (như PortalRoutes.BUSINESS_DATA).
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.role_type = 'SYSTEM'
  AND p.code IN ('school_year_profiles:write', 'school_year_profiles:reopen');

CREATE OR REPLACE FUNCTION role_permission_fits() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
    rt TEXT;
    ps TEXT;
    pc TEXT;
BEGIN
    SELECT role_type INTO rt FROM roles WHERE id = NEW.role_id;
    SELECT scope, code INTO ps, pc FROM permissions WHERE id = NEW.permission_id;
    IF rt <> 'SYSTEM' AND ps = 'SYSTEM' THEN
        RAISE EXCEPTION 'Quyền phạm vi % không gán được cho vai loại %', ps, rt USING ERRCODE = 'check_violation';
    END IF;
    IF pc = 'school_year_profiles:confirm' AND rt <> 'SCHOOL' THEN
        RAISE EXCEPTION 'Quyền % không gán được cho vai loại %', pc, rt USING ERRCODE = 'check_violation';
    END IF;
    IF rt = 'SYSTEM' AND split_part(pc, ':', 2) NOT IN ('read', 'export')
       AND split_part(pc, ':', 1) IN ('buildings', 'campuses', 'rooms', 'equipment', 'inventory_sessions',
            'school_classes', 'staff', 'staff_accounts', 'subject_teams', 'data_transfer', 'equipment_intakes',
            'purchase_proposals', 'inventory_campaigns', 'procurement_plans', 'data_imports', 'staff_assignments',
            'school_norm_adjustments', 'school_profile', 'school_year_profiles') THEN
        RAISE EXCEPTION 'Quyền % không gán được cho vai loại %: quản trị viên chỉ xem, xuất dữ liệu nghiệp vụ', pc, rt
            USING ERRCODE = 'check_violation';
    END IF;
    IF rt = 'SYSTEM' AND split_part(pc, ':', 1) = 'school_code_rules' THEN
        RAISE EXCEPTION 'Quyền % không gán được cho vai loại %', pc, rt USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $fn$;
--rollback --không khôi phục: quyền đã gỡ khỏi vai quản trị
