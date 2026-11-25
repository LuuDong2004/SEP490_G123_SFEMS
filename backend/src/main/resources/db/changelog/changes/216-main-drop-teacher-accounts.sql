--liquibase formatted sql

-- CHỈ Ở qltb_main: bỏ 4 tài khoản Giáo viên (`<mã trường>.gv01`) mà 215 tạo, cùng hồ sơ cán bộ GV01 gắn kèm.
-- Giáo viên KHÔNG phải tài khoản sử dụng hệ thống (danh mục chức năng 01.06: giáo viên chỉ là danh mục để chọn người
-- mượn, người trả, người báo hỏng / mất). Không sửa 215: có thể đã chạy trên main — lệch checksum.
-- Cột có thể trống trỏ tới tài khoản / cán bộ thì đặt trống; vai trò, phiên, thông báo tự xoá theo.

--changeset qltb:216-main-drop-teacher-accounts splitStatements:false
--preconditions onFail:CONTINUE onError:HALT
--precondition-sql-check expectedResult:1 SELECT CASE WHEN '${appStack}' = 'qltb_main' THEN 1 ELSE 0 END

DO $drop$
DECLARE
    usr BIGINT[];
    stf BIGINT[];
    fk  RECORD;
    n   BIGINT;
BEGIN
    usr := ARRAY(SELECT id FROM users
                 WHERE username IN ('79000f01.gv01', '79760503.gv01', '79760502.gv01', '79760414.gv01'));
    stf := ARRAY(SELECT id FROM staff WHERE user_id = ANY (usr));

    FOR fk IN
        SELECT c.conrelid::REGCLASS AS child, a.attname AS col, c.confrelid::REGCLASS AS parent,
               c.confdeltype AS del, a.attnotnull AS notnull
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
          AND c.confrelid IN ('users'::REGCLASS, 'staff'::REGCLASS)
          AND NOT (c.conrelid = 'staff'::REGCLASS AND a.attname = 'user_id')
    LOOP
        CONTINUE WHEN fk.del IN ('c', 'n', 'd');
        IF fk.notnull THEN
            EXECUTE format('SELECT count(*) FROM %s WHERE %I = ANY (%L::BIGINT[])', fk.child, fk.col,
                           CASE WHEN fk.parent = 'users'::REGCLASS THEN usr ELSE stf END) INTO n;
            IF n > 0 THEN
                RAISE EXCEPTION '216: dừng — % dòng %.% còn trỏ bắt buộc tới tài khoản / cán bộ cần xoá', n, fk.child, fk.col;
            END IF;
        ELSE
            EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = ANY (%L::BIGINT[])', fk.child, fk.col, fk.col,
                           CASE WHEN fk.parent = 'users'::REGCLASS THEN usr ELSE stf END);
        END IF;
    END LOOP;

    DELETE FROM staff WHERE id = ANY (stf);
    DELETE FROM users WHERE id = ANY (usr);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '216: xoá % tài khoản giáo viên', n;
END
$drop$;
