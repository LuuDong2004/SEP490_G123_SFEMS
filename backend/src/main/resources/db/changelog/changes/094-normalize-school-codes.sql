--liquibase formatted sql

-- Đánh lại mã cho dữ liệu PHÍA TRƯỜNG theo quy tắc mã của từng trường (089): phòng PH0001…, cán
-- bộ CB0001…, khối nhà NHA-01…, cơ sở CS01… — trường nào đã khai quy tắc riêng thì theo quy tắc đó.
-- Trước đây mã gõ tay mỗi nơi một kiểu (P101, P-TIN, KHO, GV01, IMP27626A…) lẫn với mã tự sinh.
--
-- Mọi liên kết đi bằng id (phòng của thiết bị, giáo viên chủ nhiệm, người phụ trách…), nên đổi mã
-- không làm gãy dữ liệu nào; tên đăng nhập đã cấp (vd. thcsbinhanq2.gv01) giữ nguyên.
-- KHÔNG đụng mã danh mục dùng chung và mã trường: chúng đang được đọc làm nhãn (năm học 2025-2026,
-- khối LOP_6) và nằm trong tên đăng nhập — bản ghi MỚI của chúng mới theo quy tắc.
--
-- Hai bước: đổi tạm sang mã không thể trùng rồi mới gán mã mới, vì unique (school_id, code) kiểm
-- từng dòng và mã mới của dòng này có thể đang là mã cũ của dòng khác.

--changeset qltb:094-normalize-school-codes
UPDATE rooms SET code = '~tmp~' || id;
UPDATE rooms r SET code = x.code
FROM (
    SELECT r.id,
           COALESCE(scr.prefix, 'PH') ||
           CASE WHEN length((COALESCE(scr.start_number, 1) + rn - 1)::text) >= COALESCE(scr.number_length, 4)
                THEN (COALESCE(scr.start_number, 1) + rn - 1)::text
                ELSE lpad((COALESCE(scr.start_number, 1) + rn - 1)::text, COALESCE(scr.number_length, 4), '0') END AS code
    FROM (
        SELECT r.id, r.school_id,
               row_number() OVER (PARTITION BY r.school_id
                                  ORDER BY b.sort_order NULLS LAST, b.id NULLS LAST,
                                           CASE WHEN r.floor ~ '^[0-9]+$' THEN r.floor::int END NULLS LAST,
                                           r.sort_order NULLS LAST, r.id) AS rn
        FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id
    ) r
    LEFT JOIN school_code_rules scr ON scr.school_id = r.school_id AND scr.target = 'rooms'
) x
WHERE x.id = r.id;

UPDATE staff SET code = '~tmp~' || id;
UPDATE staff s SET code = x.code
FROM (
    SELECT s.id,
           COALESCE(scr.prefix, 'CB') ||
           CASE WHEN length((COALESCE(scr.start_number, 1) + rn - 1)::text) >= COALESCE(scr.number_length, 4)
                THEN (COALESCE(scr.start_number, 1) + rn - 1)::text
                ELSE lpad((COALESCE(scr.start_number, 1) + rn - 1)::text, COALESCE(scr.number_length, 4), '0') END AS code
    FROM (
        SELECT id, school_id,
               row_number() OVER (PARTITION BY school_id ORDER BY sort_order NULLS LAST, id) AS rn
        FROM staff
    ) s
    LEFT JOIN school_code_rules scr ON scr.school_id = s.school_id AND scr.target = 'staff'
) x
WHERE x.id = s.id;

UPDATE buildings SET code = '~tmp~' || id;
UPDATE buildings b SET code = x.code
FROM (
    SELECT b.id,
           COALESCE(scr.prefix, 'NHA-') ||
           CASE WHEN length((COALESCE(scr.start_number, 1) + rn - 1)::text) >= COALESCE(scr.number_length, 2)
                THEN (COALESCE(scr.start_number, 1) + rn - 1)::text
                ELSE lpad((COALESCE(scr.start_number, 1) + rn - 1)::text, COALESCE(scr.number_length, 2), '0') END AS code
    FROM (
        SELECT id, school_id,
               row_number() OVER (PARTITION BY school_id ORDER BY sort_order NULLS LAST, id) AS rn
        FROM buildings
    ) b
    LEFT JOIN school_code_rules scr ON scr.school_id = b.school_id AND scr.target = 'buildings'
) x
WHERE x.id = b.id;

UPDATE campuses SET code = '~tmp~' || id;
UPDATE campuses c SET code = x.code
FROM (
    SELECT c.id,
           COALESCE(scr.prefix, 'CS') ||
           CASE WHEN length((COALESCE(scr.start_number, 1) + rn - 1)::text) >= COALESCE(scr.number_length, 2)
                THEN (COALESCE(scr.start_number, 1) + rn - 1)::text
                ELSE lpad((COALESCE(scr.start_number, 1) + rn - 1)::text, COALESCE(scr.number_length, 2), '0') END AS code
    FROM (
        SELECT id, school_id,
               row_number() OVER (PARTITION BY school_id ORDER BY sort_order NULLS LAST, id) AS rn
        FROM campuses
    ) c
    LEFT JOIN school_code_rules scr ON scr.school_id = c.school_id AND scr.target = 'campuses'
) x
WHERE x.id = c.id;
