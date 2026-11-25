--liquibase formatted sql

--changeset luudong:289-khoa-quyen-quan-tri splitStatements:false
--comment Phân quyền khớp ma trận Báo cáo 3 mục 4.4 (chốt 24/11/2026): vai quản trị chỉ xem, xuất dữ liệu nghiệp vụ, khoá bằng trigger thay cho việc chỉ thu một lần ở 284; thu các quyền cổng không mở (PortalRoutes) nên cấp cũng không có tác dụng; bỏ quyền xoá người dùng, xoá trường (chỉ khoá, ngừng dùng); bỏ quyền Tình trạng hệ thống và xuất Nhật ký hoạt động (Báo cáo 1, LI-08), giữ quyền xem lịch sử đăng nhập.

-- 1. Quyền cổng của loại vai không mở.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND ((r.role_type = 'SO' AND p.code IN ('buildings:write', 'campuses:write', 'equipment:write', 'rooms:write',
            'school_classes:write', 'staff:write', 'staff_assignments:write', 'subject_teams:write'))
    OR (r.role_type = 'SYSTEM' AND (p.code IN ('origin_sources:write', 'origin_sources:delete')
            OR split_part(p.code, ':', 1) = 'school_code_rules')));

-- 2. Quyền không còn chức năng nào dùng.
DELETE FROM permissions
WHERE code IN ('users:delete', 'schools:delete', 'activity_logs:export', 'origin_sources:write', 'origin_sources:delete')
   OR split_part(code, ':', 1) IN ('system_status', 'school_users');
DELETE FROM notifications WHERE link = '/system-status';

-- 3. Tên quyền theo chức năng còn lại.
UPDATE permissions SET name = 'Xem lịch sử đăng nhập', description = 'Các lần đăng nhập, đăng xuất của từng tài khoản'
WHERE code = 'activity_logs:read';

-- 4. CSDL giữ luật cho vai quản trị: với dữ liệu nghiệp vụ chỉ xem, xuất. Danh sách như PortalRoutes.BUSINESS_DATA cộng
--    các tài nguyên riêng của trường. RoleTypeTest so hàm này với PermissionGrants.
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
            'school_norm_adjustments', 'school_profile') THEN
        RAISE EXCEPTION 'Quyền % không gán được cho vai loại %: quản trị viên chỉ xem, xuất dữ liệu nghiệp vụ', pc, rt
            USING ERRCODE = 'check_violation';
    END IF;
    IF rt = 'SYSTEM' AND split_part(pc, ':', 1) = 'school_code_rules' THEN
        RAISE EXCEPTION 'Quyền % không gán được cho vai loại %', pc, rt USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $fn$;
--rollback --không khôi phục được: quyền đã xoá (xem 237, 284)
