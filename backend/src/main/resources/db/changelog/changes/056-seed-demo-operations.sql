--liquibase formatted sql

--changeset dth:056-seed-demo-operations
--comment Dữ liệu DEMO để chạy thử các luồng phiếu: mã rút gọn của trường, danh mục thiết bị mẫu, cơ sở vật chất và cán bộ của ba trường thử, tài khoản mẫu cho từng vai trò.

-- ĐÂY LÀ DỮ LIỆU DEMO. Trước khi đưa vào vận hành thật, mã rút gọn của trường
-- phải được thay bằng mã do Sở cấp, và các tài khoản mẫu phải bị xoá hoặc đổi
-- mật khẩu.

-- ---------------------------------------------------------------- 1. Mã rút gọn của trường
--
-- Mã tài sản (TT.TR.MH.LT.ST.NC) cần hai ký tự của trường. Không trường nào có
-- mã này nên KHÔNG sinh được tài sản nào — phiếu nhập duyệt xong sẽ bị từ chối.
-- Cấp tạm một mã hai ký tự duy nhất theo thứ tự id, bỏ O và I để không lẫn với
-- 0 và 1 khi in tem.
WITH alphabet AS (SELECT '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'::text AS a),
numbered AS (
    SELECT s.id, row_number() OVER (ORDER BY s.id) - 1 AS n
    FROM schools s
    WHERE s.short_code IS NULL
)
UPDATE schools s
SET short_code = substr(alphabet.a, (numbered.n / 34)::int + 1, 1) || substr(alphabet.a, (numbered.n % 34)::int + 1, 1)
FROM numbered, alphabet
WHERE s.id = numbered.id
  AND numbered.n < 34 * 34;

-- ---------------------------------------------------------------- 2. Danh mục thiết bị mẫu
INSERT INTO equipment_catalogs (code, name, sort_order, active, equipment_type_id, unit_id, tracking_type,
                                useful_life_years, minimum_required, created_at)
SELECT v.code, v.name, v.sort_order, TRUE,
       (SELECT id FROM equipment_types WHERE code = v.type_code),
       (SELECT id FROM units WHERE code = v.unit_code),
       v.tracking, v.life, v.minimum, now()
FROM (VALUES
    ('TB-MAYCHIEU',   'Máy chiếu đa năng',                1, 'MAY_MOC_THIET_BI',     'CHIEC', 'SERIAL', 5, TRUE),
    ('TB-MAYTINH',    'Máy tính để bàn',                  2, 'MAY_MOC_THIET_BI',     'BO',    'SERIAL', 5, TRUE),
    ('TB-LAPTOP',     'Máy tính xách tay',                3, 'MAY_MOC_THIET_BI',     'CHIEC', 'SERIAL', 5, FALSE),
    ('TB-TIVI',       'Ti vi thông minh 65 inch',         4, 'MAY_MOC_THIET_BI',     'CHIEC', 'SERIAL', 6, TRUE),
    ('TB-BANGTT',     'Bảng tương tác thông minh',        5, 'THIET_BI_DAY_HOC',     'BO',    'SERIAL', 6, FALSE),
    ('TB-LOA',        'Bộ loa, âm ly phòng học',          6, 'MAY_MOC_THIET_BI',     'BO',    'SERIAL', 5, FALSE),
    ('TB-MAYIN',      'Máy in laser',                     7, 'MAY_MOC_THIET_BI',     'CHIEC', 'SERIAL', 5, FALSE),
    ('TB-KINHHV',     'Kính hiển vi quang học',           8, 'THIET_BI_THI_NGHIEM',  'CHIEC', 'SERIAL', 8, TRUE),
    ('TB-BODIEN',     'Bộ thí nghiệm điện học',           9, 'THIET_BI_THI_NGHIEM',  'BO',    'SERIAL', 5, TRUE),
    ('TB-MOHINHCT',   'Mô hình cơ thể người',            10, 'MO_HINH_MAU_VAT',      'BO',    'SERIAL', 8, FALSE),
    ('TB-BANDOVN',    'Bản đồ hành chính Việt Nam',      11, 'TRANH_ANH_BAN_DO',     'CAI',   'BULK',   3, TRUE),
    ('TB-ONGNGHIEM',  'Ống nghiệm thuỷ tinh',            12, 'DUNG_CU',              'HOP',   'BULK',   2, TRUE)
) AS v(code, name, sort_order, type_code, unit_code, tracking, life, minimum)
WHERE NOT EXISTS (SELECT 1 FROM equipment_catalogs c WHERE c.code = v.code);

-- ---------------------------------------------------------------- 3. Ba trường thử
--
--   THCS Bình An        — UBND Phường An Khánh quản lý (trường Tiểu học, THCS)
--   THCS Đặng Tấn Tài   — cùng UBND, để thử điều chuyển giữa hai trường cùng cơ quan
--   THPT An Lạc         — Sở quản lý trực tiếp
CREATE TEMPORARY TABLE demo_school (id BIGINT, tag TEXT) ON COMMIT DROP;
INSERT INTO demo_school
SELECT id, 'thcs'  FROM schools WHERE code = 'THCSBINHANQ2'
UNION ALL SELECT id, 'thcs2' FROM schools WHERE code = 'THCSDANGTANTAI'
UNION ALL SELECT id, 'thpt'  FROM schools WHERE code = 'THPTANLAC';

INSERT INTO campuses (school_id, code, name, sort_order, active, is_primary, created_at)
SELECT d.id, 'CS1', 'Cơ sở chính', 1, TRUE, TRUE, now() FROM demo_school d
WHERE NOT EXISTS (SELECT 1 FROM campuses c WHERE c.school_id = d.id AND c.code = 'CS1');

INSERT INTO buildings (school_id, code, name, sort_order, active, campus_id, floor_count, condition, created_at)
SELECT d.id, 'NHA-A', 'Nhà A', 1, TRUE, c.id, 3, 'TOT', now()
FROM demo_school d JOIN campuses c ON c.school_id = d.id AND c.code = 'CS1'
WHERE NOT EXISTS (SELECT 1 FROM buildings b WHERE b.school_id = d.id AND b.code = 'NHA-A');

INSERT INTO rooms (school_id, code, name, sort_order, active, campus_id, building_id, room_type_id, floor,
                   capacity, condition, usage_status, created_at)
SELECT d.id, r.code, r.name, r.sort_order, TRUE, c.id, b.id,
       (SELECT id FROM room_types WHERE code = r.type_code), r.floor, r.capacity, 'TOT', 'DANG_SU_DUNG', now()
FROM demo_school d
JOIN campuses c ON c.school_id = d.id AND c.code = 'CS1'
JOIN buildings b ON b.school_id = d.id AND b.code = 'NHA-A'
CROSS JOIN (VALUES
    ('KHO',   'Kho thiết bị',          1, 'KHO',               '1', NULL),
    ('P101',  'Phòng học 101',         2, 'PHONG_HOC',         '1', 45),
    ('P102',  'Phòng học 102',         3, 'PHONG_HOC',         '1', 45),
    ('P-TIN', 'Phòng máy tính',        4, 'PHONG_MAY',         '2', 40),
    ('P-TN',  'Phòng thí nghiệm',      5, 'PHONG_THI_NGHIEM',  '2', 40),
    ('TV',    'Thư viện',              6, 'THU_VIEN',          '3', 60)
) AS r(code, name, sort_order, type_code, floor, capacity)
WHERE NOT EXISTS (SELECT 1 FROM rooms x WHERE x.school_id = d.id AND x.code = r.code);

INSERT INTO staff (school_id, code, name, sort_order, active, staff_type, position, department, created_at)
SELECT d.id, s.code, s.name, s.sort_order, TRUE, s.staff_type, s.position, s.department, now()
FROM demo_school d
CROSS JOIN (VALUES
    ('CB01', 'Nguyễn Thị Hoa',  1, 'STAFF',   'HIEU_TRUONG', 'Ban giám hiệu'),
    ('CB02', 'Trần Văn Minh',   2, 'STAFF',   'PHO_HIEU_TRUONG', 'Ban giám hiệu'),
    ('CB03', 'Lê Thị Thu',      3, 'STAFF',   'CAN_BO_THIET_BI', 'Tổ văn phòng'),
    ('GV01', 'Phạm Quốc Bảo',   4, 'TEACHER', 'GIAO_VIEN', 'Tổ Khoa học tự nhiên'),
    ('GV02', 'Võ Thanh Tâm',    5, 'TEACHER', 'GIAO_VIEN', 'Tổ Tin học'),
    ('GV03', 'Đỗ Mỹ Linh',      6, 'TEACHER', 'GIAO_VIEN', 'Tổ Xã hội')
) AS s(code, name, sort_order, staff_type, position, department)
WHERE NOT EXISTS (SELECT 1 FROM staff x WHERE x.school_id = d.id AND x.code = s.code);

-- ---------------------------------------------------------------- 4. Tài khoản mẫu
--
-- Mật khẩu chung: Demo@123. Mỗi vai trò một tài khoản, gắn đúng trường hoặc cơ
-- quan — thiếu phần gắn này thì phạm vi dữ liệu của vai trò không thấy gì.
INSERT INTO users (username, email, password_hash, full_name, status, created_at, school_id, managing_body_id)
SELECT u.username, u.username || '@demo.qltb.vn',
       '$2b$10$xWZ4pc40w3.ui50raa815ufbHe9Y6uTG/wGIPm5SAZQLS63UthxxS',
       u.full_name, 'ACTIVE', now(),
       (SELECT id FROM demo_school WHERE tag = u.school_tag),
       (SELECT id FROM departments_of_education WHERE code = u.body_code)
FROM (VALUES
    ('so.lanhdao',       'Lãnh đạo Sở (demo)',              NULL,    'SGD-HCM'),
    ('so.chuyenvien',    'Chuyên viên Sở (demo)',           NULL,    'SGD-HCM'),
    ('ubnd.lanhdao',     'Lãnh đạo UBND An Khánh (demo)',   NULL,    'UBND-27094'),
    ('ubnd.chuyenvien',  'Chuyên viên UBND An Khánh (demo)', NULL,   'UBND-27094'),
    ('thcs.hieutruong',  'Hiệu trưởng THCS Bình An (demo)', 'thcs',  NULL),
    ('thcs.canbo',       'Cán bộ thiết bị THCS Bình An (demo)', 'thcs', NULL),
    ('thcs2.hieutruong', 'Hiệu trưởng THCS Đặng Tấn Tài (demo)', 'thcs2', NULL),
    ('thcs2.canbo',      'Cán bộ thiết bị THCS Đặng Tấn Tài (demo)', 'thcs2', NULL),
    ('thpt.hieutruong',  'Hiệu trưởng THPT An Lạc (demo)',  'thpt',  NULL),
    ('thpt.canbo',       'Cán bộ thiết bị THPT An Lạc (demo)', 'thpt', NULL)
) AS u(username, full_name, school_tag, body_code)
WHERE NOT EXISTS (SELECT 1 FROM users x WHERE x.username = u.username);

INSERT INTO user_roles (user_id, role_id)
SELECT x.id, r.id
FROM (VALUES
    ('so.lanhdao', 'SO_LEADER'), ('so.chuyenvien', 'SO_SPECIALIST'),
    ('ubnd.lanhdao', 'UBND_LEADER'), ('ubnd.chuyenvien', 'UBND_SPECIALIST'),
    ('thcs.hieutruong', 'SCHOOL_LEADER'), ('thcs.canbo', 'SCHOOL_STAFF'),
    ('thcs2.hieutruong', 'SCHOOL_LEADER'), ('thcs2.canbo', 'SCHOOL_STAFF'),
    ('thpt.hieutruong', 'SCHOOL_LEADER'), ('thpt.canbo', 'SCHOOL_STAFF')
) AS m(username, role_code)
JOIN users x ON x.username = m.username
JOIN roles r ON r.code = m.role_code
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = x.id AND ur.role_id = r.id);
