--liquibase formatted sql

--changeset dth:046-seed-demo-schools
--comment Dữ liệu DEMO: 168 UBND phường/xã và 1.162 trường cấp 1-3, gắn nhãn rõ ràng để xoá được.

-- ============================================================================
-- ĐÂY LÀ DỮ LIỆU DEMO, KHÔNG PHẢI DỮ LIỆU THẬT.
--
-- Mọi dòng sinh ra ở đây đều mang mã bắt đầu bằng `DEMO-`, và `moet_code` để
-- RỖNG. Không dòng nào tự nhận là một trường có thật.
--
-- Vì sao không nhập danh sách trường thật: mã định danh cơ sở giáo dục là của
-- CSDL ngành (csdl.moet.gov.vn), không có API mở, và chỉ Sở mới kết xuất được
-- bản đầy đủ. Bịa ra những cái tên nghe như thật — "Trường THPT Nguyễn Thị
-- Minh Khai" — sẽ tạo ra hồ sơ giả trông như thật trong một hệ thống sẽ bàn
-- giao cho Sở: sai địa bàn, sai mã, thiếu trường có thật, thừa trường không
-- có. Dữ liệu demo phải TRÔNG RA là demo.
--
-- Xoá toàn bộ khi có dữ liệu thật:
--   DELETE FROM schools WHERE code LIKE 'DEMO-%';
--   DELETE FROM departments_of_education WHERE code LIKE 'DEMO-UBND-%';
--
-- QUY MÔ, theo số liệu công bố về TP.HCM sau sáp nhập 2025:
--   Tiểu học   790 - 284 (giảm 35,9% do sáp nhập trường) =  506
--   THCS       461 - 137 (giảm 29,7%)                    =  324
--   THPT       không thực hiện sáp nhập                  =  332
--                                                   tổng = 1.162
--
-- Con số 1.162 KHÁC 1.670 trong Chương V mục 3.4, và khác có lý do: phạm vi
-- hồ sơ gồm cả mầm non và trung tâm GDTX, không chỉ cấp 1-3.
-- ============================================================================

-- ---------------------------------------------------------------- 1. UBND
--
-- Một UBND cho mỗi phường/xã. Đây là thứ làm cho cây quản lý thật chạy được:
-- Sở quản lý trực tiếp THPT, còn Tiểu học và THCS thuộc UBND — không có các
-- dòng này thì không có gì để `schools.department_of_education_id` trỏ tới, và
-- chính sách "UBND chỉ thấy trường trên địa bàn mình" không kiểm chứng được.
INSERT INTO departments_of_education (code, name, province, type, status, created_at)
SELECT 'DEMO-UBND-' || w.code,
       'UBND ' || w.name,
       'Thành phố Hồ Chí Minh',
       'UBND',
       'ACTIVE',
       now()
FROM wards w
WHERE NOT EXISTS (
    SELECT 1 FROM departments_of_education d WHERE d.code = 'DEMO-UBND-' || w.code);

-- ---------------------------------------------------------------- 2. Trường
--
-- Rải đều trên 168 phường/xã bằng phép chia dư: phường thứ n nhận trường thứ
-- n, n+168, n+336... Không ngẫu nhiên — cùng một migration chạy hai nơi phải
-- ra cùng một kết quả, nếu không thì hai môi trường không so sánh được với
-- nhau.
--
-- `short_code` hai ký tự lấy theo cơ số 36 từ số thứ tự, nên 1.296 trường đầu
-- tiên là đủ chỗ (36 x 36). Đây là thành phần `TR` của mã tài sản, không phải
-- mã ngành.
WITH ward_list AS (
    SELECT id, code, name, row_number() OVER (ORDER BY code) - 1 AS idx
    FROM wards
),
ward_count AS (SELECT count(*)::int AS n FROM ward_list),
spec(level_code, label, qty, managed_by_so) AS (VALUES
    ('TH',   'Tiểu học',              506, FALSE),
    ('THCS', 'Trung học cơ sở',       324, FALSE),
    -- THPT do Sở quản lý trực tiếp; hai cấp kia do UBND phường/xã.
    ('THPT', 'Trung học phổ thông',   332, TRUE)
),
numbered AS (
    SELECT s.level_code,
           s.label,
           s.managed_by_so,
           g.i,
           w.id   AS ward_id,
           w.code AS ward_code,
           w.name AS ward_name
    FROM spec s
    CROSS JOIN LATERAL generate_series(1, s.qty) AS g(i)
    CROSS JOIN ward_count c
    JOIN ward_list w ON w.idx = (g.i - 1) % c.n
)
INSERT INTO schools (
    department_of_education_id, education_level_id, code, short_code, name,
    ward_id, address, status, created_at)
SELECT
    CASE WHEN n.managed_by_so
         THEN (SELECT id FROM departments_of_education WHERE code = 'SGD-HCM')
         ELSE (SELECT id FROM departments_of_education WHERE code = 'DEMO-UBND-' || n.ward_code)
    END,
    el.id,
    'DEMO-' || n.level_code || '-' || lpad(n.i::text, 4, '0'),
    -- Cơ số 36 hai ký tự, khác nhau giữa ba cấp nhờ cộng thêm độ lệch.
    upper(lpad(to_hex(0)::text, 0, ' ')) ||
      substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
             ((n.i + CASE n.level_code WHEN 'TH' THEN 0 WHEN 'THCS' THEN 600 ELSE 1000 END) / 36) % 36 + 1, 1) ||
      substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
             ((n.i + CASE n.level_code WHEN 'TH' THEN 0 WHEN 'THCS' THEN 600 ELSE 1000 END) % 36) + 1, 1),
    '[DEMO] Trường ' || n.label || ' số ' || n.i || ' - ' || n.ward_name,
    n.ward_id,
    'Địa chỉ demo, ' || n.ward_name,
    'ACTIVE',
    now()
FROM numbered n
JOIN education_levels el ON el.code = n.level_code
WHERE NOT EXISTS (
    SELECT 1 FROM schools s
    WHERE s.code = 'DEMO-' || n.level_code || '-' || lpad(n.i::text, 4, '0'));
