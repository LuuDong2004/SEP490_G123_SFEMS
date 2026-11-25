--liquibase formatted sql

--changeset hoangpnd:053-ma-hai-ky-tu-truong splitStatements:false
-- Mã hai ký tự của trường (TR của mã tài sản 79.TR.MH.LT.STT.NC) — đủ cho 1.099 trường công lập của Sở.
--
-- Trước đây chỉ cấp từ 01…99, A0…Z9, AA…ZZ = 1.035 mã, ít hơn 1.099 trường của tệp Sở, nên lô "Danh sách trường"
-- để trống mã và trường mới không cấp được mã tài sản ("Chưa cấp được mã chuẩn: trường chưa có mã EMIS…"). Nay
-- dùng đủ 36 × 36 = 1.296 tổ hợp: nối thêm 0A…9Z và 00 SAU thứ tự cũ (`SchoolShortCodes.ORDER` — đổi thứ tự thì
-- đổi cả hai). Vẫn đúng [A-Z0-9]{2} như `Equipment.STANDARD_CODE`, chuẩn mã tài sản không đổi.
--
-- 1. Cấp bù cho mọi trường đang trống mã, theo id, mã còn trống đầu tiên. Mã đã có (có thể đã in tem) giữ nguyên.
-- 2. Mã hai ký tự duy nhất toàn hệ thống (NV-33): hai trường cùng TR sinh trùng mã tài sản. Đang có trùng thì KHÔNG
--    tạo chỉ mục (để không chặn khởi động), chỉ báo — service vẫn kiểm trùng trước khi gán.
WITH digits AS (SELECT chr(48 + i) AS d FROM generate_series(0, 9) i),
     letters AS (SELECT chr(65 + i) AS l FROM generate_series(0, 25) i),
     cand AS (
         SELECT lpad(i::text, 2, '0') AS c, i AS ord FROM generate_series(1, 99) i
         UNION ALL SELECT l || d, 100 + (ascii(l) - 65) * 10 + (ascii(d) - 48) FROM letters, digits
         UNION ALL SELECT a.l || b.l, 1000 + (ascii(a.l) - 65) * 26 + (ascii(b.l) - 65) FROM letters a, letters b
         UNION ALL SELECT d || l, 2000 + (ascii(d) - 48) * 26 + (ascii(l) - 65) FROM digits, letters
         UNION ALL SELECT '00', 3000),
     free AS (
         SELECT c, row_number() OVER (ORDER BY ord) AS rn FROM cand
         WHERE c NOT IN (SELECT upper(btrim(short_code)) FROM schools
                         WHERE short_code IS NOT NULL AND btrim(short_code) <> '')),
     need AS (
         SELECT id, row_number() OVER (ORDER BY id) AS rn FROM schools
         WHERE short_code IS NULL OR btrim(short_code) = '')
UPDATE schools s SET short_code = f.c
FROM need n JOIN free f ON f.rn = n.rn
WHERE s.id = n.id;

DO $short$
DECLARE
    dup TEXT;
    left_over INT;
BEGIN
    SELECT count(*) INTO left_over FROM schools WHERE short_code IS NULL OR btrim(short_code) = '';
    IF left_over > 0 THEN
        RAISE NOTICE '217: còn % trường chưa có mã hai ký tự (hết tổ hợp)', left_over;
    END IF;
    SELECT string_agg(code, ', ') INTO dup FROM (
        SELECT upper(btrim(short_code)) AS code FROM schools
        WHERE short_code IS NOT NULL AND btrim(short_code) <> ''
        GROUP BY 1 HAVING count(*) > 1) d;
    IF dup IS NULL THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_schools_short_code ON schools (upper(short_code));
    ELSE
        RAISE NOTICE '217: mã hai ký tự đang trùng (%), chưa tạo chỉ mục duy nhất', dup;
    END IF;
END
$short$;
--rollback DROP INDEX IF EXISTS uq_schools_short_code;
