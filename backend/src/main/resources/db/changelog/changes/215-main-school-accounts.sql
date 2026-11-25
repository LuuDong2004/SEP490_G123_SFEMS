--liquibase formatted sql

-- TÀI KHOẢN BỐN TRƯỜNG KIỂM THỬ + UBND QUẢN LÝ CHÚNG — CHỈ Ở qltb_main, chạy sau 214 (main còn đúng danh sách
-- trường chuẩn, mã trường = mã Sở).
--
-- Trường (theo danh sách chuẩn của Sở): THPT chuyên Lê Hồng Phong (79000F01, Sở quản lý), THCS Minh Đức (79760503,
-- UBND Phường Cầu Ông Lãnh), THCS Trần Văn Ơn (79760502, UBND Phường Tân Định), TH Nguyễn Bỉnh Khiêm (79760414,
-- UBND Phường Sài Gòn). Mỗi trường bốn vai — Hiệu trưởng, Cán bộ thiết bị, Tổ trưởng chuyên môn, Giáo viên — như
-- StaffAccountService tự cấp: hồ sơ cán bộ HT01 / CBTB01 / TT01 / GV01 gắn tài khoản `<mã trường>.<mã cán bộ>`.
-- Ba UBND quản lý trường mỗi nơi một Lãnh đạo, một Chuyên viên (`ubnd-<mã>.<vai>`, như 211). Tài khoản Sở và UBND
-- Phường Bến Thành của 211 giữ nguyên.
--
-- Mật khẩu chung Demo@123 (người dùng chốt cho môi trường kiểm thử, cùng bản băm với 056 / 211) — không qua
-- PasswordPolicy nhưng luật chỉ kiểm lúc đặt / đổi. Thiếu trường / cơ quan nào thì dừng hẳn; đã có thì để yên.

--changeset qltb:215-main-school-accounts splitStatements:false
--preconditions onFail:CONTINUE onError:HALT
--precondition-sql-check expectedResult:1 SELECT CASE WHEN '${appStack}' = 'qltb_main' THEN 1 ELSE 0 END

DO $accounts$
DECLARE
    missing TEXT;
BEGIN
    SELECT string_agg(c, ', ') INTO missing
    FROM unnest(ARRAY['79000F01', '79760503', '79760502', '79760414']) AS c
    WHERE NOT EXISTS (SELECT 1 FROM schools s WHERE s.code = c);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION '215: không thấy trường mã %', missing;
    END IF;
    SELECT string_agg(c, ', ') INTO missing
    FROM unnest(ARRAY['UBND-26758', 'UBND-26737', 'UBND-26740']) AS c
    WHERE NOT EXISTS (SELECT 1 FROM departments_of_education d WHERE d.code = c);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION '215: không thấy cơ quan mã %', missing;
    END IF;
END
$accounts$;

CREATE TEMP TABLE acc (
    username TEXT, full_name TEXT, role_code TEXT, body_code TEXT, school_code TEXT,
    staff_code TEXT, staff_name TEXT, staff_type TEXT, position TEXT, sort_order INT
) ON COMMIT DROP;

INSERT INTO acc (username, full_name, role_code, body_code)
SELECT lower(b.code) || '.' || r.suffix, r.title || ' ' || b.label, r.role_code, b.code
FROM (VALUES
    ('UBND-26758', 'UBND Phường Cầu Ông Lãnh'),
    ('UBND-26737', 'UBND Phường Tân Định'),
    ('UBND-26740', 'UBND Phường Sài Gòn')
) AS b(code, label)
CROSS JOIN (VALUES
    ('lanhdao',    'Lãnh đạo',    'UBND_LEADER'),
    ('chuyenvien', 'Chuyên viên', 'UBND_SPECIALIST')
) AS r(suffix, title, role_code);

INSERT INTO acc (username, full_name, role_code, school_code, staff_code, staff_name, staff_type, position, sort_order)
SELECT lower(s.code) || '.' || lower(p.staff_code), p.staff_name || ' - ' || s.label,
       p.role_code, s.code, p.staff_code, p.staff_name, p.staff_type, p.position, p.sort_order
FROM (VALUES
    ('79000F01', 'THPT chuyên Lê Hồng Phong'),
    ('79760503', 'THCS Minh Đức'),
    ('79760502', 'THCS Trần Văn Ơn'),
    ('79760414', 'TH Nguyễn Bỉnh Khiêm')
) AS s(code, label)
CROSS JOIN (VALUES
    ('HT01',   'Hiệu trưởng',          'SCHOOL_LEADER', 'STAFF',   'HIEU_TRUONG',     1),
    ('CBTB01', 'Cán bộ thiết bị',      'SCHOOL_STAFF',  'STAFF',   'CAN_BO_THIET_BI', 2),
    ('TT01',   'Tổ trưởng chuyên môn', 'SUBJECT_HEAD',  'TEACHER', 'TO_TRUONG',       3),
    ('GV01',   'Giáo viên',            'TEACHER',       'TEACHER', 'GIAO_VIEN',       4)
) AS p(staff_code, staff_name, role_code, staff_type, position, sort_order);

INSERT INTO users (username, email, password_hash, full_name, status, created_at, password_changed_at,
                   school_id, managing_body_id)
SELECT a.username, a.username || '@qltb.local',
       '$2b$10$xWZ4pc40w3.ui50raa815ufbHe9Y6uTG/wGIPm5SAZQLS63UthxxS',
       a.full_name, 'ACTIVE', now(), now(),
       (SELECT id FROM schools WHERE code = a.school_code),
       (SELECT id FROM departments_of_education WHERE code = a.body_code)
FROM acc a
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.username = a.username);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM acc a
JOIN users u ON u.username = a.username
JOIN roles r ON r.code = a.role_code
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

INSERT INTO staff (school_id, code, name, sort_order, active, staff_type, position, created_at, user_id)
SELECT s.id, a.staff_code, a.staff_name, a.sort_order, TRUE, a.staff_type, a.position, now(), u.id
FROM acc a
JOIN schools s ON s.code = a.school_code
JOIN users u ON u.username = a.username
WHERE a.school_code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM staff x WHERE x.school_id = s.id AND x.code = a.staff_code)
  AND NOT EXISTS (SELECT 1 FROM staff x WHERE x.user_id = u.id);
