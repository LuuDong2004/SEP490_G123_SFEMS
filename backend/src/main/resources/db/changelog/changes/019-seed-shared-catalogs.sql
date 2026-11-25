--liquibase formatted sql

--changeset dth:019-seed-shared-catalogs
--comment Mã quyền, phân quyền theo vai trò và dữ liệu tham chiếu cho năm danh mục dùng chung.

-- Dữ liệu dưới đây lấy nguyên từ bản Jmix (062-catalog-seed và các changelog
-- đơn vị tính / học kỳ), không bịa lại: đây là dữ liệu tham chiếu có thật mà
-- mọi trường dùng chung, không phải dữ liệu demo.
--
-- Mã quyền theo đúng quy tắc của nền: {resource}:{read|write|delete}, và
-- CatalogController SUY RA chúng từ tên resource. Seed ở đây là nửa còn lại:
-- một mã quyền không được cấp cho ai thì không ai gọi được endpoint.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('equipment_types:read',   'Xem loại thiết bị',  'Xem danh sách và chi tiết loại thiết bị', TRUE),
  ('equipment_types:write',  'Sửa loại thiết bị',  'Thêm và sửa loại thiết bị',               TRUE),
  ('equipment_types:delete', 'Xoá loại thiết bị',  'Xoá vĩnh viễn một loại thiết bị',         TRUE),
  ('units:read',   'Xem đơn vị tính',  'Xem danh sách và chi tiết đơn vị tính', TRUE),
  ('units:write',  'Sửa đơn vị tính',  'Thêm và sửa đơn vị tính',               TRUE),
  ('units:delete', 'Xoá đơn vị tính',  'Xoá vĩnh viễn một đơn vị tính',         TRUE),
  ('origin_sources:read',   'Xem nguồn hình thành',  'Xem danh sách và chi tiết nguồn hình thành', TRUE),
  ('origin_sources:write',  'Sửa nguồn hình thành',  'Thêm và sửa nguồn hình thành',               TRUE),
  ('origin_sources:delete', 'Xoá nguồn hình thành',  'Xoá vĩnh viễn một nguồn hình thành',         TRUE),
  ('acquisition_methods:read',   'Xem hình thức mua sắm',  'Xem danh sách và chi tiết hình thức mua sắm', TRUE),
  ('acquisition_methods:write',  'Sửa hình thức mua sắm',  'Thêm và sửa hình thức mua sắm',               TRUE),
  ('acquisition_methods:delete', 'Xoá hình thức mua sắm',  'Xoá vĩnh viễn một hình thức mua sắm',         TRUE),
  ('semesters:read',   'Xem học kỳ',  'Xem danh sách và chi tiết học kỳ', TRUE),
  ('semesters:write',  'Sửa học kỳ',  'Thêm và sửa học kỳ',               TRUE),
  ('semesters:delete', 'Xoá học kỳ',  'Xoá vĩnh viễn một học kỳ',         TRUE);

-- ADMIN nhận đủ. Phải viết tường minh: 005 cấp cho ADMIN mọi quyền tồn tại
-- VÀO LÚC NÓ CHẠY, mà khi đó các dòng trên chưa có.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('equipment_types:read', 'equipment_types:write', 'equipment_types:delete', 'units:read', 'units:write', 'units:delete', 'origin_sources:read', 'origin_sources:write', 'origin_sources:delete', 'acquisition_methods:read', 'acquisition_methods:write', 'acquisition_methods:delete', 'semesters:read', 'semesters:write', 'semesters:delete')
WHERE r.code = 'ADMIN';

-- MANAGER (vai Sở) duy trì danh mục nhưng không xoá: danh mục là dữ liệu
-- tham chiếu mà bản ghi khác trỏ vào, "ngưng dùng" bằng cờ active mới là thao
-- tác đúng. Cùng quyết định như education_levels.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('equipment_types:read', 'equipment_types:write', 'units:read', 'units:write', 'origin_sources:read', 'origin_sources:write', 'acquisition_methods:read', 'acquisition_methods:write', 'semesters:read', 'semesters:write')
WHERE r.code = 'MANAGER';

-- USER chỉ đọc, và PHẢI đọc được: đây là thứ xuất hiện trong ô chọn của mọi
-- màn nghiệp vụ. Thiếu quyền thì ô chọn rỗng mà không có lỗi nào.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('equipment_types:read', 'units:read', 'origin_sources:read', 'acquisition_methods:read', 'semesters:read')
WHERE r.code = 'USER';

INSERT INTO equipment_types (code, name, sort_order, active, created_at) VALUES
  ('THIET_BI_DAY_HOC', 'Thiết bị dạy học', 1, TRUE, now()),
  ('THIET_BI_THI_NGHIEM', 'Thiết bị thí nghiệm', 2, TRUE, now()),
  ('DO_DUNG_DAY_HOC', 'Đồ dùng dạy học', 3, TRUE, now()),
  ('TRANH_ANH_BAN_DO', 'Tranh ảnh / bản đồ', 4, TRUE, now()),
  ('MAY_MOC_THIET_BI', 'Máy móc thiết bị', 5, TRUE, now()),
  ('DUNG_CU', 'Dụng cụ', 6, TRUE, now()),
  ('HOA_CHAT', 'Hóa chất', 7, TRUE, now()),
  ('MO_HINH_MAU_VAT', 'Mô hình / mẫu vật', 8, TRUE, now()),
  ('THIET_BI_CNTT', 'Thiết bị CNTT', 9, TRUE, now()),
  ('KHAC', 'Khác', 10, TRUE, now());

INSERT INTO units (code, name, sort_order, active, created_at) VALUES
  ('CAI', 'Cái', 1, TRUE, now()),
  ('CHIEC', 'Chiếc', 2, TRUE, now()),
  ('BO', 'Bộ', 3, TRUE, now()),
  ('HOP', 'Hộp', 4, TRUE, now()),
  ('THUNG', 'Thùng', 5, TRUE, now()),
  ('KG', 'Kg', 6, TRUE, now()),
  ('MET', 'Mét', 7, TRUE, now()),
  ('CUON', 'Cuộn', 8, TRUE, now()),
  ('TO', 'Tờ', 9, TRUE, now()),
  ('BINH', 'Bình', 10, TRUE, now()),
  ('LO', 'Lọ', 11, TRUE, now());

INSERT INTO origin_sources (code, name, sort_order, active, created_at) VALUES
  ('NGAN_SACH', 'Ngân sách nhà nước', 1, TRUE, now()),
  ('XA_HOI_HOA', 'Xã hội hóa', 2, TRUE, now()),
  ('TAI_TRO', 'Tài trợ', 3, TRUE, now()),
  ('VIEN_TRO', 'Viện trợ', 4, TRUE, now()),
  ('TU_MUA', 'Trường tự mua', 5, TRUE, now()),
  ('KHAC', 'Khác', 6, TRUE, now());

INSERT INTO acquisition_methods (code, name, sort_order, active, created_at) VALUES
  ('TAP_TRUNG', 'Mua sắm tập trung', 1, TRUE, now()),
  ('DAU_THAU', 'Đấu thầu', 2, TRUE, now()),
  ('CHI_DINH_THAU', 'Chỉ định thầu', 3, TRUE, now()),
  ('MUA_TRUC_TIEP', 'Mua trực tiếp', 4, TRUE, now()),
  ('DUOC_CAP', 'Được cấp', 5, TRUE, now()),
  ('TANG', 'Tặng/biếu', 6, TRUE, now()),
  ('KHAC', 'Khác', 7, TRUE, now());

INSERT INTO semesters (code, name, sort_order, active, created_at) VALUES
  ('HOC_KY_1', 'Học kỳ 1', 1, TRUE, now()),
  ('HOC_KY_2', 'Học kỳ 2', 2, TRUE, now()),
  ('CA_NAM', 'Cả năm', 3, TRUE, now());
