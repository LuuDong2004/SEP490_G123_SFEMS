--liquibase formatted sql

-- TÀI KHOẢN KIỂM THỬ CHO GIÁM SÁT / CHỦ ĐẦU TƯ — CHỈ Ở qltb_main, chạy sau 210 (xoá dữ liệu demo).
--
-- Sở GD&ĐT: Lãnh đạo Sở, Chuyên viên Sở. UBND Phường Bến Thành (quản lý ba trường Quận 1 dưới đây): Lãnh
-- đạo UBND, Chuyên viên UBND. Bốn trường — THPT Chuyên Lê Hồng Phong (Sở quản lý), THCS Minh Đức, THCS Trần
-- Văn Ơn, Tiểu học Nguyễn Bỉnh Khiêm (Quận 1) — mỗi trường đủ bốn vai phía trường: Hiệu trưởng, Cán bộ thiết
-- bị, Tổ trưởng chuyên môn, Giáo viên.
--
-- Tài khoản trường theo đúng cách hệ thống tự cấp (StaffAccountService): mỗi người là một hồ sơ cán bộ
-- (HT01, CBTB01, TT01, GV01, đúng chức vụ) gắn tài khoản `<mã trường>.<mã cán bộ>`. Sở / UBND không có quy
-- tắc riêng → `<mã cơ quan>.<vai>`. Thư điện tử `<tài khoản>@qltb.local` như tài khoản trường tự cấp.
--
-- Mật khẩu chung Demo@123 (người dùng chốt cho môi trường kiểm thử) — cùng bản băm với tài khoản demo của
-- 056. Mật khẩu này KHÔNG qua PasswordPolicy (từ phổ biến; vai Sở cần 12 ký tự), nhưng luật chỉ kiểm lúc
-- đặt / đổi, không kiểm lúc đăng nhập: đăng nhập được, đổi mật khẩu thì phải đạt luật.
--
-- Thiếu trường / cơ quan nào (mã bị đổi khi nhập dữ liệu) thì dừng hẳn, không lặng lẽ thiếu tài khoản.
-- Tài khoản / hồ sơ cán bộ đã có thì để yên — chạy lại không nhân đôi.

--changeset qltb:211-main-test-accounts splitStatements:false
--preconditions onFail:CONTINUE onError:HALT
--precondition-sql-check expectedResult:1 SELECT CASE WHEN '${appStack}' = 'qltb_main' THEN 1 ELSE 0 END

DO $accounts$
DECLARE
    missing TEXT;
BEGIN
    SELECT string_agg(c, ', ') INTO missing
    FROM unnest(ARRAY['WWW-2', 'THCSMINHDUC', 'THCSTRANVANON', 'THNGUYENBINHKHIEM']) AS c
    WHERE NOT EXISTS (SELECT 1 FROM schools s WHERE s.code = c);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION '211: không thấy trường mã %', missing;
    END IF;
    SELECT string_agg(c, ', ') INTO missing
    FROM unnest(ARRAY['SGD-HCM', 'UBND-26743']) AS c
    WHERE NOT EXISTS (SELECT 1 FROM departments_of_education d WHERE d.code = c);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION '211: không thấy cơ quan mã %', missing;
    END IF;
END
$accounts$;

CREATE TEMP TABLE acc (
    username TEXT, full_name TEXT, role_code TEXT,
    body_code TEXT, school_code TEXT, school_name TEXT,
    staff_code TEXT, staff_name TEXT, staff_type TEXT, position TEXT, sort_order INT
) ON COMMIT DROP;

INSERT INTO acc (username, full_name, role_code, body_code) VALUES
    ('sgd-hcm.lanhdao',       'Lãnh đạo Sở',                        'SO_LEADER',       'SGD-HCM'),
    ('sgd-hcm.chuyenvien',    'Chuyên viên Sở (CSVC - Thiết bị)',   'SO_SPECIALIST',   'SGD-HCM'),
    ('ubnd-26743.lanhdao',    'Lãnh đạo UBND Phường Bến Thành',     'UBND_LEADER',     'UBND-26743'),
    ('ubnd-26743.chuyenvien', 'Chuyên viên UBND Phường Bến Thành',  'UBND_SPECIALIST', 'UBND-26743');

INSERT INTO acc (username, full_name, role_code, school_code, school_name, staff_code, staff_name, staff_type, position, sort_order)
SELECT lower(s.code) || '.' || lower(p.staff_code),
       p.staff_name || ' - ' || s.label,
       p.role_code, s.code, s.label, p.staff_code, p.staff_name, p.staff_type, p.position, p.sort_order
FROM (VALUES
    ('WWW-2',             'THPT Chuyên Lê Hồng Phong'),
    ('THCSMINHDUC',       'THCS Minh Đức'),
    ('THCSTRANVANON',     'THCS Trần Văn Ơn'),
    ('THNGUYENBINHKHIEM', 'TH Nguyễn Bỉnh Khiêm')
) AS s(code, label)
CROSS JOIN (VALUES
    ('HT01',   'Hiệu trưởng',          'SCHOOL_LEADER', 'STAFF',   'HIEU_TRUONG',     1),
    ('CBTB01', 'Cán bộ thiết bị',      'SCHOOL_STAFF',  'STAFF',   'CAN_BO_THIET_BI', 2),
    ('TT01',   'Tổ trưởng chuyên môn', 'SUBJECT_HEAD',  'TEACHER', 'TO_TRUONG',       3),
    ('GV01',   'Giáo viên',            'TEACHER',       'TEACHER', 'GIAO_VIEN',       4)
) AS p(staff_code, staff_name, role_code, staff_type, position, sort_order);

-- Tài khoản (Demo@123 — cùng bản băm với 056).
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

-- Hồ sơ cán bộ của trường, gắn tài khoản như "Cấp tài khoản" trên màn Cán bộ.
INSERT INTO staff (school_id, code, name, sort_order, active, staff_type, position, created_at, user_id)
SELECT s.id, a.staff_code, a.staff_name, a.sort_order, TRUE, a.staff_type, a.position, now(), u.id
FROM acc a
JOIN schools s ON s.code = a.school_code
JOIN users u ON u.username = a.username
WHERE a.school_code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM staff x WHERE x.school_id = s.id AND x.code = a.staff_code)
  AND NOT EXISTS (SELECT 1 FROM staff x WHERE x.user_id = u.id);
