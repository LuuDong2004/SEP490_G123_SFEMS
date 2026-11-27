--liquibase formatted sql

--changeset luudong:310-danh-muc-chi-ngung-dung
--comment Mục của danh mục dùng chung không xoá, chỉ ngừng dùng (active = FALSE): mục đã có thể đang được phiếu, thiết bị, hồ sơ của các trường trỏ tới, ngừng dùng thì không chọn mới được nhưng dữ liệu cũ vẫn đọc đúng. Gỡ quyền xoá của 15 danh mục — nút Xoá ẩn theo quyền. Bộ danh mục tối thiểu và định mức giữ quyền xoá: chỉ xoá được bản NHÁP đang soạn, bộ đã áp dụng vẫn chỉ ngừng áp dụng.
DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code IN (
    'wards:delete', 'facility_groups:delete', 'room_types:delete', 'facility_standard_rules:delete',
    'school_years:delete', 'grades:delete', 'subject_groups:delete', 'subjects:delete', 'education_levels:delete',
    'equipment_catalogs:delete', 'equipment_types:delete', 'units:delete', 'equipment_configs:delete',
    'legal_documents:delete', 'acquisition_methods:delete'));
DELETE FROM permissions WHERE code IN (
    'wards:delete', 'facility_groups:delete', 'room_types:delete', 'facility_standard_rules:delete',
    'school_years:delete', 'grades:delete', 'subject_groups:delete', 'subjects:delete', 'education_levels:delete',
    'equipment_catalogs:delete', 'equipment_types:delete', 'units:delete', 'equipment_configs:delete',
    'legal_documents:delete', 'acquisition_methods:delete');
--rollback INSERT INTO permissions (code, name, description, system_permission, scope) SELECT r || ':delete', 'Xoá ' || r, 'Xoá vĩnh viễn một mục của danh mục', TRUE, 'ORGANIZATION' FROM unnest(ARRAY['wards', 'facility_groups', 'room_types', 'facility_standard_rules', 'school_years', 'grades', 'subject_groups', 'subjects', 'education_levels', 'equipment_catalogs', 'equipment_types', 'units', 'equipment_configs', 'legal_documents', 'acquisition_methods']) AS r;
--rollback INSERT INTO role_permissions (role_id, permission_id) SELECT ro.id, p.id FROM roles ro, permissions p WHERE ro.code IN ('ADMIN', 'SO_SPECIALIST') AND p.code IN ('wards:delete', 'facility_groups:delete', 'room_types:delete', 'facility_standard_rules:delete', 'school_years:delete', 'grades:delete', 'subject_groups:delete', 'subjects:delete', 'education_levels:delete', 'equipment_catalogs:delete', 'equipment_types:delete', 'units:delete', 'equipment_configs:delete', 'legal_documents:delete', 'acquisition_methods:delete');
