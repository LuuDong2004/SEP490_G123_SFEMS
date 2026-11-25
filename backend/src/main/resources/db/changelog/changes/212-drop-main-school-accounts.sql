--liquibase formatted sql

-- CHỈ Ở qltb_main: bỏ 16 tài khoản trường mà 211 tạo (THPT Chuyên Lê Hồng Phong, THCS Minh Đức, THCS Trần Văn
-- Ơn, TH Nguyễn Bỉnh Khiêm × Hiệu trưởng / Cán bộ thiết bị / Tổ trưởng / Giáo viên) cùng hồ sơ cán bộ gắn
-- kèm — danh sách trường chuẩn sắp được nhập lại, tài khoản trường cấp sau theo danh sách đó. Giữ admin và bốn
-- tài khoản Sở / UBND Phường Bến Thành của 211.
--
-- Không sửa 211: nó có thể đã chạy trên main, sửa là lệch checksum và Liquibase không cho khởi động.
-- Cột trỏ tới tài khoản / cán bộ có thể trống (người tạo, người duyệt, nhật ký…) thì đặt trống; vai trò, phiên,
-- thông báo của tài khoản tự xoá theo.

--changeset qltb:212-drop-main-school-accounts splitStatements:false
--preconditions onFail:CONTINUE onError:HALT
--precondition-sql-check expectedResult:1 SELECT CASE WHEN '${appStack}' = 'qltb_main' THEN 1 ELSE 0 END

DO $drop$
DECLARE
    usr BIGINT[];
    stf BIGINT[];
    fk  RECORD;
    n   BIGINT;
BEGIN
    usr := ARRAY(
        SELECT u.id FROM users u
        WHERE u.username IN (
            SELECT lower(s) || '.' || lower(p)
            FROM unnest(ARRAY['WWW-2', 'THCSMINHDUC', 'THCSTRANVANON', 'THNGUYENBINHKHIEM']) AS s
            CROSS JOIN unnest(ARRAY['HT01', 'CBTB01', 'TT01', 'GV01']) AS p));
    stf := ARRAY(SELECT id FROM staff WHERE user_id = ANY (usr));

    -- Cột có thể trống trỏ tới các tài khoản / cán bộ này: đặt trống. Cột bắt buộc mà không tự xoá theo thì dừng.
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
                RAISE EXCEPTION '212: dừng — % dòng %.% còn trỏ bắt buộc tới tài khoản / cán bộ cần xoá', n, fk.child, fk.col;
            END IF;
        ELSE
            EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = ANY (%L::BIGINT[])', fk.child, fk.col, fk.col,
                           CASE WHEN fk.parent = 'users'::REGCLASS THEN usr ELSE stf END);
        END IF;
    END LOOP;

    DELETE FROM staff WHERE id = ANY (stf);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '212: xoá % hồ sơ cán bộ', n;
    DELETE FROM users WHERE id = ANY (usr);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '212: xoá % tài khoản trường', n;
END
$drop$;
