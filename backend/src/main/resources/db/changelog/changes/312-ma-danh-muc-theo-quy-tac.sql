--liquibase formatted sql

--changeset luudong:312-ma-danh-muc-theo-quy-tac splitStatements:false
--comment Mã của Loại CSVC, Đơn vị tính, Hình thức mua sắm, Tổ chuyên môn đổi sang mã của quy tắc sinh mã (LPH001, DVT001, HTM001, TCM001…) để bộ đếm tự tăng dùng được và danh sách chỉ một kiểu mã. Mã chữ cũ mà nghiệp vụ dựa vào (KHO, THU_VIEN, NHA_AN, PHONG_HOC, TAP_TRUNG, DUOC_CAP, KHAC…) chuyển sang cột khoá hệ thống system_key (ẩn, không sửa được); mục thêm sau không có khoá. Mã chuẩn CSVC (<mã loại>.<cấp>.<mức>) sinh lại theo mã loại mới.

-- 1. Khoá hệ thống: giữ mã chữ cũ.
ALTER TABLE room_types ADD COLUMN system_key VARCHAR(64);
ALTER TABLE units ADD COLUMN system_key VARCHAR(64);
ALTER TABLE acquisition_methods ADD COLUMN system_key VARCHAR(64);
UPDATE room_types SET system_key = code;
UPDATE units SET system_key = code;
UPDATE acquisition_methods SET system_key = code;
ALTER TABLE room_types ADD CONSTRAINT uq_room_types_system_key UNIQUE (system_key);
ALTER TABLE units ADD CONSTRAINT uq_units_system_key UNIQUE (system_key);
ALTER TABLE acquisition_methods ADD CONSTRAINT uq_acquisition_methods_system_key UNIQUE (system_key);

-- 2. Mã theo quy tắc: tiền tố + số thứ tự đủ độ dài, theo thứ tự đang hiện (sort_order rồi id); bộ đếm đứng ở số cuối.
CREATE FUNCTION pg_temp.renumber(tbl TEXT) RETURNS VOID LANGUAGE plpgsql AS $fn$
DECLARE
    p TEXT;
    s TEXT;
    len INT;
    n BIGINT;
BEGIN
    SELECT prefix, COALESCE(suffix, ''), number_length INTO p, s, len FROM code_rules WHERE code_rules.target = tbl;
    IF p IS NULL THEN
        RAISE EXCEPTION 'Không có quy tắc sinh mã cho %', tbl;
    END IF;
    EXECUTE format($q$
        UPDATE %1$I t SET code = %2$L || lpad(x.n::text, %3$s, '0') || %4$L, updated_at = now()
        FROM (SELECT id, row_number() OVER (ORDER BY sort_order NULLS LAST, id) AS n FROM %1$I) x
        WHERE x.id = t.id$q$, tbl, p, len, s);
    EXECUTE format('SELECT count(*) FROM %I', tbl) INTO n;
    UPDATE code_rules SET current_number = n, active = TRUE, updated_at = now() WHERE code_rules.target = tbl;
END $fn$;
SELECT pg_temp.renumber('room_types');
SELECT pg_temp.renumber('units');
SELECT pg_temp.renumber('acquisition_methods');
SELECT pg_temp.renumber('subject_groups');

-- 3. Mã chuẩn CSVC theo mã loại mới (FacilityStandardRuleService.codeOf).
UPDATE facility_standard_rules f SET code = rt.code || '.' || f.level_code || '.' || f.tier, updated_at = now()
FROM room_types rt
WHERE rt.id = f.room_type_id;
--rollback UPDATE room_types SET code = system_key WHERE system_key IS NOT NULL;
--rollback UPDATE units SET code = system_key WHERE system_key IS NOT NULL;
--rollback UPDATE acquisition_methods SET code = system_key WHERE system_key IS NOT NULL;
--rollback UPDATE facility_standard_rules f SET code = rt.code || '.' || f.level_code || '.' || f.tier FROM room_types rt WHERE rt.id = f.room_type_id;
--rollback UPDATE code_rules SET current_number = 0 WHERE target IN ('room_types', 'units', 'acquisition_methods', 'subject_groups');
--rollback ALTER TABLE room_types DROP COLUMN system_key;
--rollback ALTER TABLE units DROP COLUMN system_key;
--rollback ALTER TABLE acquisition_methods DROP COLUMN system_key;
