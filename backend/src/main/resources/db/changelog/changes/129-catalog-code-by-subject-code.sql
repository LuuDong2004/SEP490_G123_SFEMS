--liquibase formatted sql

-- Mã thiết bị trong danh mục theo MÃ MÔN HỌC, không theo chữ viết tắt (QLTB-414): THCS-NV-001 → THCS-09-001
-- (Ngữ văn = 09), cùng mã môn với phần MH của mã định danh tài sản (TT.TR.MH.LT.ST.NC). Mã môn là
-- `subjects.teaching_code` (không có thì `subjects.code`); thiết bị không gắn môn dùng `00` (Dùng chung).
-- Dòng phụ lục của bộ tiêu chuẩn đổi theo cùng luật: DM-THCS-NV-001 → DM-THCS-09-001.
--
-- Số thứ tự GIỮ NGUYÊN. Trong mỗi cấp, mỗi chữ viết tắt ứng đúng một môn nên dãy cũ thành dãy mới một-một;
-- chỉ khi hai dãy cũ rơi vào cùng một mã môn (vd. dãy `<cấp>-M<mã môn>-…` máy cấp cho môn chưa có thiết bị)
-- mà trùng số thì dòng sau được số nối tiếp số lớn nhất của dãy. Đồ ngoài danh mục của trường (NDM-…) và dòng
-- không theo dạng `<cấp>-<môn>-<số>` không đổi.

--changeset qltb:129-catalog-code-by-subject-code
CREATE TEMP TABLE catalog_recode ON COMMIT DROP AS
WITH src AS (
    SELECT c.id,
           el.code || '-' || COALESCE(NULLIF(s.teaching_code, ''), s.code, '00') AS pfx,
           CAST(substring(c.code FROM '-([0-9]+)$') AS INTEGER) AS num
    FROM equipment_catalogs c
    JOIN education_levels el ON el.id = c.education_level_id
    LEFT JOIN subjects s ON s.id = c.subject_id
    WHERE c.owner_school_id IS NULL
      AND c.code ~ ('^' || el.code || '-[A-Z0-9]+-[0-9]+$')
), ranked AS (
    SELECT src.*,
           ROW_NUMBER() OVER (PARTITION BY pfx, num ORDER BY id) AS dup,
           MAX(num) OVER (PARTITION BY pfx) AS top
    FROM src
), renumbered AS (
    SELECT id, pfx,
           CASE WHEN dup = 1 THEN num
                ELSE top + ROW_NUMBER() OVER (PARTITION BY pfx, dup > 1 ORDER BY id) END AS num
    FROM ranked
)
SELECT id, pfx || '-' || LPAD(CAST(num AS TEXT), 3, '0') AS code FROM renumbered;

UPDATE equipment_catalogs c
SET code = r.code, updated_at = now()
FROM catalog_recode r
WHERE r.id = c.id AND c.code <> r.code;

CREATE TEMP TABLE norm_recode ON COMMIT DROP AS
WITH src AS (
    SELECT n.id, n.standard_id,
           'DM-' || el.code || '-' || COALESCE(NULLIF(s.teaching_code, ''), s.code, '00') AS pfx,
           CAST(substring(n.code FROM '-([0-9]+)$') AS INTEGER) AS num
    FROM equipment_norms n
    JOIN equipment_standards st ON st.id = n.standard_id
    JOIN education_levels el ON el.id = st.education_level_id
    LEFT JOIN subjects s ON s.id = n.subject_id
    WHERE n.code ~ ('^DM-' || el.code || '-[A-Z0-9]+-[0-9]+$')
), ranked AS (
    SELECT src.*,
           ROW_NUMBER() OVER (PARTITION BY standard_id, pfx, num ORDER BY id) AS dup,
           MAX(num) OVER (PARTITION BY standard_id, pfx) AS top
    FROM src
), renumbered AS (
    SELECT id, pfx,
           CASE WHEN dup = 1 THEN num
                ELSE top + ROW_NUMBER() OVER (PARTITION BY standard_id, pfx, dup > 1 ORDER BY id) END AS num
    FROM ranked
)
SELECT id, pfx || '-' || LPAD(CAST(num AS TEXT), 3, '0') AS code FROM renumbered;

UPDATE equipment_norms n
SET code = r.code, updated_at = now()
FROM norm_recode r
WHERE r.id = n.id AND n.code <> r.code;
