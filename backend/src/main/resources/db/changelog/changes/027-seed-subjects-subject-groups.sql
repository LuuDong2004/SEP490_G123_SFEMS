--liquibase formatted sql

--changeset dth:027-seed-subjects-subject-groups
--comment Mã quyền, phân quyền, 19 môn học, 8 dòng môn theo cấp và 16 tổ chuyên môn.

-- Dữ liệu lấy từ bản Jmix. Hai chỗ khác:
--   * bản Jmix ghi cấp học Tiểu học là mã TIEU_HOC; danh mục cấp học ở đây dùng
--     mã TH (013-seed-education-levels), nên nối theo TH
--   * bản Jmix không có dòng nào nối tổ chuyên môn với môn học, nên ở đây cũng
--     không có — người quản trị gán trên màn tổ chuyên môn
-- Mọi tham chiếu nối theo MÃ, không theo id: id là identity và không được ghim.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('subjects:read',   'Xem môn học', 'Xem danh sách và chi tiết môn học', TRUE),
  ('subjects:write',  'Sửa môn học', 'Thêm và sửa môn học',               TRUE),
  ('subjects:delete', 'Xoá môn học', 'Xoá vĩnh viễn một môn học',         TRUE),
  ('subject_groups:read',   'Xem tổ chuyên môn', 'Xem danh sách và chi tiết tổ chuyên môn', TRUE),
  ('subject_groups:write',  'Sửa tổ chuyên môn', 'Thêm và sửa tổ chuyên môn',               TRUE),
  ('subject_groups:delete', 'Xoá tổ chuyên môn', 'Xoá vĩnh viễn một tổ chuyên môn',         TRUE);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('subjects:read', 'subjects:write', 'subjects:delete', 'subject_groups:read', 'subject_groups:write', 'subject_groups:delete')
WHERE r.code = 'ADMIN';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('subjects:read', 'subjects:write', 'subject_groups:read', 'subject_groups:write')
WHERE r.code = 'MANAGER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('subjects:read', 'subject_groups:read')
WHERE r.code = 'USER';

INSERT INTO subjects (code, name, teaching_code, sort_order, active, created_at) VALUES
  ('TOAN', 'Toán', NULL, 1, TRUE, now()),
  ('VAT_LY', 'Vật lý', NULL, 2, TRUE, now()),
  ('HOA_HOC', 'Hóa học', NULL, 3, TRUE, now()),
  ('SINH_HOC', 'Sinh học', NULL, 4, TRUE, now()),
  ('NGU_VAN', 'Ngữ văn', NULL, 5, TRUE, now()),
  ('LICH_SU', 'Lịch sử', NULL, 6, TRUE, now()),
  ('DIA_LY', 'Địa lý', NULL, 7, TRUE, now()),
  ('TIENG_ANH', 'Tiếng Anh', NULL, 8, TRUE, now()),
  ('TIN_HOC', 'Tin học', NULL, 9, TRUE, now()),
  ('GDCD', 'Giáo dục công dân', NULL, 10, TRUE, now()),
  ('CONG_NGHE', 'Công nghệ', NULL, 11, TRUE, now()),
  ('AM_NHAC', 'Âm nhạc', NULL, 12, TRUE, now()),
  ('MY_THUAT', 'Mỹ thuật', NULL, 13, TRUE, now()),
  ('THE_DUC', 'Thể dục', NULL, 14, TRUE, now()),
  ('CHUNG', 'Dùng chung', NULL, 15, TRUE, now()),
  ('HD_TRAI_NGHIEM', 'Hoạt động trải nghiệm', '22', 16, TRUE, now()),
  ('NGOAI_NGU_KHAC', 'Ngoại ngữ khác', '23', 17, TRUE, now()),
  ('KHOA_HOC', 'Khoa học (Tiểu học)', '24', 18, TRUE, now()),
  ('TU_NHIEN_XA_HOI', 'Tự nhiên và Xã hội (Tiểu học)', '25', 19, TRUE, now());

INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, sort_order, created_at)
SELECT s.id, e.id, 'BAT_BUOC', 1, now() FROM subjects s, education_levels e WHERE s.code = 'HD_TRAI_NGHIEM' AND e.code = 'TH';
INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, sort_order, created_at)
SELECT s.id, e.id, 'BAT_BUOC', 2, now() FROM subjects s, education_levels e WHERE s.code = 'HD_TRAI_NGHIEM' AND e.code = 'THCS';
INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, sort_order, created_at)
SELECT s.id, e.id, 'BAT_BUOC', 3, now() FROM subjects s, education_levels e WHERE s.code = 'HD_TRAI_NGHIEM' AND e.code = 'THPT';
INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, sort_order, created_at)
SELECT s.id, e.id, 'BAT_BUOC', 4, now() FROM subjects s, education_levels e WHERE s.code = 'NGOAI_NGU_KHAC' AND e.code = 'TH';
INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, sort_order, created_at)
SELECT s.id, e.id, 'BAT_BUOC', 5, now() FROM subjects s, education_levels e WHERE s.code = 'NGOAI_NGU_KHAC' AND e.code = 'THCS';
INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, sort_order, created_at)
SELECT s.id, e.id, 'BAT_BUOC', 6, now() FROM subjects s, education_levels e WHERE s.code = 'NGOAI_NGU_KHAC' AND e.code = 'THPT';
INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, sort_order, created_at)
SELECT s.id, e.id, 'BAT_BUOC', 7, now() FROM subjects s, education_levels e WHERE s.code = 'KHOA_HOC' AND e.code = 'TH';
INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, sort_order, created_at)
SELECT s.id, e.id, 'BAT_BUOC', 8, now() FROM subjects s, education_levels e WHERE s.code = 'TU_NHIEN_XA_HOI' AND e.code = 'TH';

INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'TH-K1', 'Tổ Khối lớp 1', 1, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'TH-K2', 'Tổ Khối lớp 2', 2, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'TH-K3', 'Tổ Khối lớp 3', 3, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'TH-K4', 'Tổ Khối lớp 4', 4, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'TH-K5', 'Tổ Khối lớp 5', 5, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'TH-CMCB', 'Tổ Chuyên môn cơ bản', 6, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'TH';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THCS-KHTN', 'Tổ Khoa học tự nhiên', 7, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THCS';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THCS-KHXH', 'Tổ Khoa học xã hội', 8, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THCS';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THCS-THOC', 'Tổ Tin học', 9, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THCS';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THCS-TD', 'Tổ Thể dục', 10, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THCS';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THCS-HDTN-HN', 'Tổ Hoạt động trải nghiệm, hướng nghiệp', 11, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THCS';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THPT-KHTN-XH', 'Tổ Khoa học tự nhiên - xã hội', 12, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THPT';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THPT-GDKTPL', 'Tổ Giáo dục kinh tế và pháp luật', 13, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THPT';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THPT-CN-NT', 'Tổ Công nghệ - Nghệ thuật', 14, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THPT';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THPT-GDTC', 'Tổ Giáo dục thể chất', 15, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THPT';
INSERT INTO subject_groups (code, name, sort_order, active, education_level_id, created_at)
SELECT 'THPT-GDQPAN', 'Tổ Giáo dục quốc phòng và an ninh', 16, TRUE, e.id, now() FROM education_levels e WHERE e.code = 'THPT';
