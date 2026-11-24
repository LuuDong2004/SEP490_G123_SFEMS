--liquibase formatted sql

-- Quy tắc sinh mã của các DANH MỤC DÙNG CHUNG, lấy đúng từ "Tùy chỉnh mã danh mục tự động" của bản
-- Jmix (tiền tố, độ dài phần số). 029 cố ý không seed; giờ có bộ quy tắc đang dùng thật bên Jmix nên
-- nạp nguyên bộ — form thêm mới của mỗi danh mục điền sẵn mã kế tiếp (HTM001, DVT001…), người dùng
-- vẫn sửa được (CodeGenerator.resolveOnCreate).
--
-- Bộ đếm KHÔNG đặt cứng 0: lấy SỐ LỚN NHẤT đang dùng cùng tiền tố trong bảng (như Jmix đồng bộ bộ
-- đếm với dữ liệu có sẵn), để mã đầu tiên cấp ra không trùng mã đã có. Danh mục hiện mang mã ngữ
-- nghĩa (TOAN, LOP_10…) nên thường là 0.
--
-- Các loại thuộc phạm vi TRƯỜNG (phòng, cán bộ, khối nhà, cơ sở) KHÔNG ở đây mà ở school_code_rules
-- (089) — mỗi trường một cách đặt, mặc định theo Jmix (PH0001, CB0001).

--changeset qltb:090-seed-code-rules-from-jmix
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'ACQUISITION_METHOD', 'Hình thức mua sắm/tiếp nhận', 1, TRUE, 'acquisition_methods', 'HTM', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^HTM([0-9]{1,18})$')::bigint) FROM acquisition_methods), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'acquisition_methods');
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'EDUCATION_LEVEL', 'Cấp học', 2, TRUE, 'education_levels', 'CH', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^CH([0-9]{1,18})$')::bigint) FROM education_levels), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'education_levels');
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'EQUIPMENT_TYPE', 'Loại thiết bị', 3, TRUE, 'equipment_types', 'LTB', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^LTB([0-9]{1,18})$')::bigint) FROM equipment_types), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'equipment_types');
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'GRADE', 'Khối lớp', 4, TRUE, 'grades', 'KL', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^KL([0-9]{1,18})$')::bigint) FROM grades), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'grades');
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'MOVEMENT_REASON', 'Lý do điều chuyển/sửa chữa/thanh lý', 5, TRUE, 'movement_reasons', 'LD', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^LD([0-9]{1,18})$')::bigint) FROM movement_reasons), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'movement_reasons');
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'ORIGIN_SOURCE', 'Nguồn hình thành', 6, TRUE, 'origin_sources', 'NG', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^NG([0-9]{1,18})$')::bigint) FROM origin_sources), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'origin_sources');
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'ROOM_TYPE', 'Loại phòng', 7, TRUE, 'room_types', 'LPH', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^LPH([0-9]{1,18})$')::bigint) FROM room_types), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'room_types');
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'SCHOOL_YEAR', 'Năm học', 8, TRUE, 'school_years', 'NH', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^NH([0-9]{1,18})$')::bigint) FROM school_years), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'school_years');
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'SUBJECT', 'Môn học', 9, TRUE, 'subjects', 'MH', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^MH([0-9]{1,18})$')::bigint) FROM subjects), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'subjects');
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'UNIT', 'Đơn vị tính', 10, TRUE, 'units', 'DVT', 3,
       COALESCE((SELECT max(substring(upper(code) FROM '^DVT([0-9]{1,18})$')::bigint) FROM units), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'units');
--rollback DELETE FROM code_rules WHERE code IN ('ACQUISITION_METHOD', 'EDUCATION_LEVEL', 'EQUIPMENT_TYPE', 'GRADE', 'MOVEMENT_REASON', 'ORIGIN_SOURCE', 'ROOM_TYPE', 'SCHOOL_YEAR', 'SUBJECT', 'UNIT');
