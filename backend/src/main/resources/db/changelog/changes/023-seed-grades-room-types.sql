--liquibase formatted sql

--changeset dth:023-seed-grades-room-types
--comment Mã quyền, phân quyền, 12 khối lớp và 8 loại phòng.

-- Dữ liệu lấy từ bản Jmix (062-catalog-seed). Bản Jmix có một dòng LOP_11 bị
-- lặp; ở đây chỉ giữ một.
--
-- Cấp học của mỗi khối là hệ thống giáo dục phổ thông Việt Nam: lớp 1-5 tiểu
-- học, 6-9 trung học cơ sở, 10-12 trung học phổ thông. Nối theo MÃ cấp học chứ
-- không theo id, vì id là identity và không được ghim.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('grades:read',   'Xem khối lớp', 'Xem danh sách và chi tiết khối lớp', TRUE),
  ('grades:write',  'Sửa khối lớp', 'Thêm và sửa khối lớp',               TRUE),
  ('grades:delete', 'Xoá khối lớp', 'Xoá vĩnh viễn một khối lớp',         TRUE),
  ('room_types:read',   'Xem loại phòng', 'Xem danh sách và chi tiết loại phòng', TRUE),
  ('room_types:write',  'Sửa loại phòng', 'Thêm và sửa loại phòng',               TRUE),
  ('room_types:delete', 'Xoá loại phòng', 'Xoá vĩnh viễn một loại phòng',         TRUE);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('grades:read', 'grades:write', 'grades:delete', 'room_types:read', 'room_types:write', 'room_types:delete')
WHERE r.code = 'ADMIN';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('grades:read', 'grades:write', 'room_types:read', 'room_types:write')
WHERE r.code = 'MANAGER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('grades:read', 'room_types:read')
WHERE r.code = 'USER';

INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_1', 'Lớp 1', 1, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_2', 'Lớp 2', 2, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_3', 'Lớp 3', 3, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_4', 'Lớp 4', 4, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_5', 'Lớp 5', 5, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_6', 'Lớp 6', 6, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THCS';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_7', 'Lớp 7', 7, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THCS';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_8', 'Lớp 8', 8, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THCS';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_9', 'Lớp 9', 9, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THCS';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_10', 'Lớp 10', 10, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THPT';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_11', 'Lớp 11', 11, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THPT';
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT 'LOP_12', 'Lớp 12', 12, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THPT';

-- Loại phòng dùng chung cho mọi cấp học, nên không gắn cấp học nào.
INSERT INTO room_types (code, name, sort_order, active, created_at) VALUES
  ('PHONG_HOC', 'Phòng học', 1, TRUE, now()),
  ('PHONG_BO_MON', 'Phòng bộ môn', 2, TRUE, now()),
  ('PHONG_THI_NGHIEM', 'Phòng thí nghiệm', 3, TRUE, now()),
  ('PHONG_MAY', 'Phòng máy tính', 4, TRUE, now()),
  ('THU_VIEN', 'Thư viện', 5, TRUE, now()),
  ('KHO', 'Kho thiết bị', 6, TRUE, now()),
  ('PHONG_CHUC_NANG', 'Phòng chức năng', 7, TRUE, now()),
  ('KHAC', 'Khác', 8, TRUE, now());
