--liquibase formatted sql

-- CHỈ Ở qltb_main: xoá danh sách trường KHÔNG CHUẨN (946 trường của 050, lấy từ Cổng dữ liệu mở, không có mã Sở,
-- cơ quan quản lý suy đoán ở 054) — trưởng nhóm chốt 11/11/2026.
--
-- Bối cảnh: danh sách trường chuẩn của Sở (1.099 trường, có mã Sở) đã nhập lên main bằng lô "Danh sách trường"
-- trước khi màn nhập biết ghép theo tên, nên được THÊM bên cạnh 946 trường cũ (2.045 trường, trùng). Dữ liệu nghiệp
-- vụ của main đã bị 210 xoá hết, nên trường cũ không còn gì gắn vào. Xoá chúng thì main còn đúng danh sách chuẩn;
-- lần nhập sau ghép theo mã Sở: khớp thì bỏ qua, đổi thì cập nhật, thiếu thì thêm.
--
-- Chỉ xoá trường CHƯA có mã Sở VÀ không còn dòng nào ở bất kỳ bảng nào trỏ tới (tài khoản, cán bộ, phòng, thiết bị,
-- lô nhập…) — trường nào còn bị trỏ thì giữ, báo số trong log. Đính kèm của trường bị xoá xoá theo. Danh sách trường
-- chuẩn chưa nhập (không có trường nào có mã Sở) thì không xoá gì — tránh để main không còn trường nào.

--changeset qltb:214-main-drop-unofficial-schools splitStatements:false
--preconditions onFail:CONTINUE onError:HALT
--precondition-sql-check expectedResult:1 SELECT CASE WHEN '${appStack}' = 'qltb_main' THEN 1 ELSE 0 END

DO $drop$
DECLARE
    fk       RECORD;
    official BIGINT;
    n        BIGINT;
BEGIN
    SELECT count(*) INTO official FROM schools WHERE moet_code IS NOT NULL;
    IF official = 0 THEN
        RAISE NOTICE '214: chưa có trường nào mang mã Sở — không xoá gì';
        RETURN;
    END IF;

    CREATE TEMP TABLE drop_school ON COMMIT DROP AS SELECT id FROM schools WHERE moet_code IS NULL;

    -- Bỏ khỏi danh sách xoá mọi trường còn bị một bảng nào trỏ tới.
    FOR fk IN
        SELECT c.conrelid::REGCLASS AS child, a.attname AS col
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confrelid = 'schools'::REGCLASS AND cardinality(c.conkey) = 1
    LOOP
        EXECUTE format('DELETE FROM drop_school d WHERE EXISTS (SELECT 1 FROM %s x WHERE x.%I = d.id)', fk.child, fk.col);
    END LOOP;

    SELECT count(*) INTO n FROM schools WHERE moet_code IS NULL AND id NOT IN (SELECT id FROM drop_school);
    IF n > 0 THEN
        RAISE NOTICE '214: giữ % trường chưa có mã Sở vì còn dữ liệu trỏ tới', n;
    END IF;

    DELETE FROM attachments WHERE resource = 'schools' AND record_id IN (SELECT id FROM drop_school);
    DELETE FROM schools WHERE id IN (SELECT id FROM drop_school);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '214: xoá % trường không chuẩn, còn % trường có mã Sở', n, official;
END
$drop$;
