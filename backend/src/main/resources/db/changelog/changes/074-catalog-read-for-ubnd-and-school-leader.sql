--liquibase formatted sql

--changeset qltb:074-catalog-read-for-ubnd-and-school-leader
-- Lãnh đạo UBND, chuyên viên UBND và lãnh đạo trường bị 403 trên các danh mục dùng
-- chung (đơn vị tính, môn học, năm học, học kỳ, khối lớp, nguồn hình thành, hình thức
-- mua sắm, lý do biến động, loại phòng, bộ chuẩn/định mức/bộ thông số...). Các màn
-- của họ dùng chính những danh mục đó cho ô chọn, bộ lọc và nhãn, nên form ra ô rỗng,
-- màn chi tiết ra "—" — hỏng mà không báo lỗi nào.
--
-- Ma trận quyền (docs/phantich/qltb-use-case.xlsx, sheet "Ma tran quyen", dòng "Danh mục
-- và dữ liệu dùng chung") cho MỌI vai "Xem". Đây là dữ liệu tham chiếu công khai, không
-- nằm dưới phạm vi dòng và không lộ gì của trường nào, nên cấp `read` không mở rộng quyền
-- đối với dữ liệu nghiệp vụ. Chỉ `read` — sửa danh mục vẫn là việc của Sở và quản trị.
-- `code_rules` (quy tắc sinh mã) không nằm trong danh sách: đó là cấu hình hệ thống.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'acquisition_methods:read', 'education_levels:read', 'equipment_configs:read',
    'equipment_norms:read', 'equipment_standards:read', 'grades:read',
    'movement_reasons:read', 'origin_sources:read', 'room_types:read',
    'school_years:read', 'semesters:read', 'subject_groups:read',
    'subjects:read', 'units:read', 'wards:read')
WHERE r.code IN ('UBND_LEADER', 'UBND_SPECIALIST', 'SCHOOL_LEADER')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

--changeset qltb:074-so-specialist-catalog-delete
-- Chuyên viên Sở thêm, sửa được danh mục dùng chung mà không xoá được — ma trận quyền
-- ghi "Sửa" = thêm/sửa/xoá cho vai này ở dòng "Danh mục và dữ liệu dùng chung". Cấp
-- `delete` đúng trên những danh mục họ đã có `write`. Danh mục đang được tham chiếu thì
-- khoá ngoại RESTRICT vẫn chặn (409), nên xoá không làm mồ côi dữ liệu nào.
-- Không đụng tới cơ quan quản lý, trường, cán bộ: đó là tổ chức, không phải danh mục.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, del.id
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions w ON w.id = rp.permission_id
JOIN permissions del ON del.code = split_part(w.code, ':', 1) || ':delete'
WHERE r.code = 'SO_SPECIALIST'
  AND split_part(w.code, ':', 2) = 'write'
  AND split_part(w.code, ':', 1) IN (
      'acquisition_methods', 'education_levels', 'equipment_catalogs', 'equipment_configs',
      'equipment_norms', 'equipment_standards', 'equipment_types', 'grades',
      'movement_reasons', 'origin_sources', 'room_types', 'school_years', 'semesters',
      'subject_groups', 'subjects', 'units', 'wards')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = del.id);
