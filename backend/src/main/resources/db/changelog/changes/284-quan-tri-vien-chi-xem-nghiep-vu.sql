--liquibase formatted sql

--changeset luudong:284-quan-tri-vien-chi-xem-nghiep-vu
--comment Quản trị viên chỉ cấu hình, hỗ trợ, quản trị hệ thống (đảo 281, chốt 22/11/2026): với dữ liệu nghiệp vụ của trường và Sở chỉ giữ quyền xem, xuất; thu quyền lập / sửa / xoá / duyệt phiếu, thiết bị, phòng, nhân sự, nhập dữ liệu đầu vào. Khác 272: vẫn giữ quyền đọc nên các màn tổng hợp, báo cáo, tra cứu không lỗi 403. Hồ sơ năm học giữ khởi tạo / mở lại (hỗ trợ trường ở màn Trường học), thu xác nhận / chốt.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = 'ADMIN'
  AND split_part(p.code, ':', 1) IN ('buildings', 'campuses', 'rooms', 'equipment', 'equipment_items', 'school_classes',
      'staff', 'staff_accounts', 'staff_assignments', 'subject_teams', 'school_norm_adjustments', 'school_profile',
      'data_imports', 'data_transfer', 'purchase_proposals', 'procurement_plans', 'equipment_intakes',
      'inventory_campaigns', 'inventory_sessions')
  AND split_part(p.code, ':', 2) NOT IN ('read', 'export');
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = 'ADMIN'
  AND p.code = 'school_year_profiles:confirm';
--rollback INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'ADMIN' AND ((split_part(p.code, ':', 1) IN ('buildings', 'campuses', 'rooms', 'equipment', 'equipment_items', 'school_classes', 'staff', 'staff_accounts', 'staff_assignments', 'subject_teams', 'school_norm_adjustments', 'school_profile', 'data_imports', 'data_transfer', 'purchase_proposals', 'procurement_plans', 'equipment_intakes', 'inventory_campaigns', 'inventory_sessions') AND split_part(p.code, ':', 2) NOT IN ('read', 'export')) OR p.code = 'school_year_profiles:confirm') ON CONFLICT DO NOTHING;
