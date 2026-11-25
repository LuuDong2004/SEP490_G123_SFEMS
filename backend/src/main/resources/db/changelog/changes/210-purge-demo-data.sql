--liquibase formatted sql

-- XOÁ DỮ LIỆU DEMO — CHỈ Ở qltb_main (môi trường giám sát thi công / Chủ đầu tư kiểm thử).
--
-- PHẠM VI (trưởng nhóm chốt 11/11/2026): xoá MỌI dữ liệu nghiệp vụ của MỌI trường — thiết bị, mọi loại phiếu,
-- kế hoạch (kể cả kế hoạch mua sắm, đợt kiểm kê cấp UBND / Sở), cơ sở / nhà / phòng, cán bộ, lớp, tổ, lô nhập,
-- bộ đếm số phiếu / mã tài sản — và mọi tài khoản gắn vào trường. CHỈ GIỮ danh mục dùng chung (trường, cơ
-- quan, phường, môn, danh mục thiết bị, định mức, loại phòng, đơn vị tính…), vai trò, quyền, admin và tài
-- khoản Sở / UBND, nhật ký thao tác và lịch sử thay đổi (`data_changes` chỉ-thêm). Danh sách trường chuẩn và
-- dữ liệu đầu vào của trường được nhập lại sau. Đoạn dưới đây là bối cảnh ban đầu (ba trường demo).
--
-- Demo của 056 / 061 / 080 / 088 / 101 mượn ba trường THẬT trong danh sách 946 trường (050):
-- THCS Bình An, THCS Đặng Tấn Tài, THPT An Lạc, và mười tài khoản demo (so.*, ubnd.*, thcs.*, thcs2.*,
-- thpt.*). Changeset này xoá mọi thứ gắn vào ba trường đó (tài khoản, cơ sở / nhà / phòng, cán bộ,
-- lớp, tổ, thiết bị, mọi loại phiếu, kế hoạch, số thứ tự phiếu / mã tài sản…) — cả dữ liệu người
-- test tự tạo thêm trên main — cùng mọi thứ của mười tài khoản demo và hai tài khoản mẫu manager / viewer
-- của 005 (mật khẩu công khai trong repo; chỉ còn admin). GIỮ dòng trường (trường có thật).
-- Trường DEMO-, UBND DEMO- đã bị 050 xoá từ trước.
--
-- Không đụng: danh mục (076 / 077 / 097 nay là cấu hình của danh mục thật), mã viết tắt trường, dev, UAT.
--
-- Chỉ chạy khi APP_STACK = qltb_main (spring.liquibase.parameters.appStack). Ở stack khác điều kiện
-- sai → onFail:CONTINUE: bỏ qua, không đánh dấu đã chạy — main gộp ngược về dev / UAT thì dữ liệu demo
-- bên đó vẫn còn.
--
-- Cách xoá: gom theo khoá ngoại (một dòng bị gom thì mọi dòng trỏ NOT NULL / trỏ bắt buộc tới nó cũng
-- bị gom), rồi xoá theo thứ tự phụ thuộc. Rào chắn: gom phải thiết bị / phòng / cán bộ / tài khoản của
-- trường KHÁC, hoặc chạm danh mục gốc, là dừng cả changeset — giao dịch quay lui, không mất gì.
-- Tệp trên MinIO của các đính kèm bị xoá thành tệp mồ côi, không ảnh hưởng chức năng.

--changeset qltb:210-purge-demo-data splitStatements:false
--preconditions onFail:CONTINUE onError:HALT
--precondition-sql-check expectedResult:1 SELECT CASE WHEN '${appStack}' = 'qltb_main' THEN 1 ELSE 0 END

CREATE TEMP TABLE purge_set (tbl TEXT NOT NULL, id BIGINT NOT NULL, PRIMARY KEY (tbl, id)) ON COMMIT DROP;
CREATE TEMP TABLE purge_ctx (schools BIGINT[] NOT NULL, users BIGINT[] NOT NULL) ON COMMIT DROP;

-- Gom các dòng của p_tbl thoả p_cond, rồi đệ quy xuống mọi bảng trỏ tới chúng.
CREATE FUNCTION pg_temp.purge_collect(p_tbl REGCLASS, p_cond TEXT, p_depth INT) RETURNS VOID AS $fn$
DECLARE
    t       TEXT := p_tbl::TEXT;
    n       BIGINT;
    fk      RECORD;
    sch     BIGINT[] := (SELECT schools FROM purge_ctx);
    col     TEXT;
BEGIN
    IF p_depth > 20 THEN
        RAISE EXCEPTION 'purge-demo: chuỗi phụ thuộc quá sâu tại %', t;
    END IF;

    -- Bảng nối không có cột id: xoá thẳng (là lá, không ai trỏ tới).
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = p_tbl AND attname = 'id' AND NOT attisdropped) THEN
        EXECUTE format('DELETE FROM %s WHERE %s', p_tbl, p_cond);
        RETURN;
    END IF;

    EXECUTE format(
        'INSERT INTO purge_set (tbl, id) SELECT %L, x.id FROM %s x WHERE (%s) ON CONFLICT DO NOTHING',
        t, p_tbl, p_cond);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
        RETURN;
    END IF;

    -- Rào chắn 1: danh mục gốc không bao giờ bị xoá.
    IF t IN ('schools', 'departments_of_education', 'roles', 'permissions', 'subjects', 'education_levels',
             'grades', 'room_types', 'units', 'wards', 'school_years', 'semesters', 'equipment_types',
             'equipment_standards', 'equipment_norms', 'origin_sources', 'acquisition_methods',
             'movement_reasons', 'approval_flows', 'row_level_policy', 'subject_groups') THEN
        RAISE EXCEPTION 'purge-demo: dừng — sẽ xoá % dòng danh mục gốc %', n, t;
    END IF;

    -- Rào chắn 2: tài sản / người của trường khác không bao giờ bị xoá.
    IF t IN ('equipment', 'rooms', 'buildings', 'campuses', 'staff', 'users', 'school_classes') THEN
        EXECUTE format(
            'SELECT count(*) FROM %s x JOIN purge_set p ON p.tbl = %L AND p.id = x.id
              WHERE x.school_id IS NOT NULL AND NOT (x.school_id = ANY (%L::BIGINT[]))',
            p_tbl, t, sch) INTO n;
        IF n > 0 THEN
            RAISE EXCEPTION 'purge-demo: dừng — sẽ xoá % dòng % của trường không phải demo', n, t;
        END IF;
    END IF;

    FOR fk IN
        SELECT c.conrelid::REGCLASS AS child, a.attname AS col, af.attname AS refcol,
               c.confdeltype AS del, a.attnotnull AS notnull
        FROM pg_constraint c
        JOIN pg_attribute a  ON a.attrelid  = c.conrelid  AND a.attnum  = c.conkey[1]
        JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
        WHERE c.contype = 'f' AND c.confrelid = p_tbl AND cardinality(c.conkey) = 1
    LOOP
        IF fk.refcol <> 'id' THEN
            RAISE EXCEPTION 'purge-demo: khoá ngoại %.% không trỏ vào id', fk.child, fk.col;
        END IF;
        CONTINUE WHEN fk.del IN ('n', 'd');  -- CSDL tự đặt NULL / mặc định
        col := fk.col;
        PERFORM pg_temp.purge_collect(
            fk.child, format('%I IN (SELECT id FROM purge_set WHERE tbl = %L)', col, t), p_depth + 1);
    END LOOP;
END
$fn$ LANGUAGE plpgsql;

DO $purge$
DECLARE
    sch      BIGINT[];
    usr      BIGINT[];
    fk       RECORD;
    t        RECORD;
    n        BIGINT;
    progress BOOLEAN;
    left_tbl TEXT[];
    rounds   INT := 0;
BEGIN
    -- MỌI trường (trưởng nhóm chốt 11/11/2026): xoá hết dữ liệu nghiệp vụ, chỉ giữ danh mục dùng chung.
    sch := ARRAY(SELECT id FROM schools);
    usr := ARRAY(SELECT id FROM users
                 WHERE username IN ('manager', 'viewer',  -- tài khoản mẫu của 005, mật khẩu công khai
                                    'so.lanhdao', 'so.chuyenvien', 'ubnd.lanhdao', 'ubnd.chuyenvien',
                                    'thcs.hieutruong', 'thcs.canbo', 'thcs2.hieutruong', 'thcs2.canbo',
                                    'thpt.hieutruong', 'thpt.canbo')
                    OR school_id = ANY (sch));
    INSERT INTO purge_ctx VALUES (sch, usr);
    RAISE NOTICE 'purge-demo: % trường, % tài khoản', cardinality(sch), cardinality(usr);

    -- 1. Mọi dòng gắn trực tiếp vào ba trường (kể cả bảng xoá dây chuyền: số thứ tự phiếu, mã tài sản…).
    FOR fk IN
        SELECT c.conrelid::REGCLASS AS child, a.attname AS col
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confrelid = 'schools'::REGCLASS AND cardinality(c.conkey) = 1
          AND c.conrelid <> 'users'::REGCLASS  -- tài khoản đi bước 2
    LOOP
        PERFORM pg_temp.purge_collect(fk.child, format('%I = ANY (%L::BIGINT[])', fk.col, sch), 1);
    END LOOP;
    -- Phiếu / kế hoạch cấp UBND, Sở không gắn thẳng vào trường: kế hoạch mua sắm, đợt kiểm kê.
    PERFORM pg_temp.purge_collect('procurement_plans', 'TRUE', 1);
    PERFORM pg_temp.purge_collect('inventory_campaigns', 'TRUE', 1);

    -- 2. Tài khoản demo: nhật ký thao tác của họ xoá; cột "người tạo / người duyệt" có thể trống trên
    --    dữ liệu còn lại thì để trống; trỏ bắt buộc thì gom như mọi dòng khác (rào chắn vẫn áp dụng).
    PERFORM pg_temp.purge_collect('activity_logs', format('actor_id = ANY (%L::BIGINT[])', usr), 1);
    FOR fk IN
        SELECT c.conrelid::REGCLASS AS child, a.attname AS col, c.confdeltype AS del, a.attnotnull AS notnull
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confrelid = 'users'::REGCLASS AND cardinality(c.conkey) = 1
          AND c.conrelid <> 'users'::REGCLASS
    LOOP
        CONTINUE WHEN fk.del IN ('n', 'd');
        IF NOT fk.notnull THEN
            EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = ANY (%L::BIGINT[])', fk.child, fk.col, fk.col, usr);
        ELSE
            PERFORM pg_temp.purge_collect(fk.child, format('%I = ANY (%L::BIGINT[])', fk.col, usr), 1);
        END IF;
    END LOOP;
    PERFORM pg_temp.purge_collect('users', format('id = ANY (%L::BIGINT[])', usr), 1);

    -- 3. Bảng trỏ "mềm" theo (resource, id): đính kèm, dòng thời gian phiếu, nhật ký. KHÔNG đụng
    --    `data_changes` (lịch sử thay đổi): bảng chỉ-thêm, trigger `data_changes_append_only` cấm sửa / xoá —
    --    là vết kiểm toán, giữ nguyên; không có khoá ngoại nên dòng của bản ghi đã xoá không cản gì.
    PERFORM pg_temp.purge_collect('attachments',
        '(resource, record_id::TEXT) IN (SELECT tbl, id::TEXT FROM purge_set)', 1);
    PERFORM pg_temp.purge_collect('voucher_events',
        '(resource, voucher_id) IN (SELECT tbl, id FROM purge_set)', 1);
    PERFORM pg_temp.purge_collect('activity_logs',
        '(resource, record_id::TEXT) IN (SELECT tbl, id::TEXT FROM purge_set)', 1);

    -- 4. Cắt vòng: cột có thể trống trỏ giữa các dòng sắp xoá thì đặt trống trước.
    FOR fk IN
        SELECT c.conrelid::REGCLASS AS child, a.attname AS col, c.confrelid::REGCLASS AS parent
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND cardinality(c.conkey) = 1 AND NOT a.attnotnull
          AND c.conrelid::TEXT IN (SELECT DISTINCT tbl FROM purge_set)
          AND c.confrelid::TEXT IN (SELECT DISTINCT tbl FROM purge_set)
    LOOP
        EXECUTE format(
            'UPDATE %s SET %I = NULL WHERE id IN (SELECT id FROM purge_set WHERE tbl = %L)
               AND %I IN (SELECT id FROM purge_set WHERE tbl = %L)',
            fk.child, fk.col, fk.child::TEXT, fk.col, fk.parent::TEXT);
    END LOOP;

    -- 5. Xoá: bảng nào còn bị trỏ thì để vòng sau.
    CREATE TEMP TABLE purge_done (tbl TEXT PRIMARY KEY) ON COMMIT DROP;
    LOOP
        rounds := rounds + 1;
        progress := FALSE;
        left_tbl := '{}';
        FOR t IN SELECT tbl, count(*) AS cnt FROM purge_set
                 WHERE tbl NOT IN (SELECT tbl FROM purge_done) GROUP BY tbl ORDER BY tbl
        LOOP
            BEGIN
                EXECUTE format('DELETE FROM %I WHERE id IN (SELECT id FROM purge_set WHERE tbl = %L)', t.tbl, t.tbl);
                GET DIAGNOSTICS n = ROW_COUNT;
                INSERT INTO purge_done VALUES (t.tbl);
                RAISE NOTICE 'purge-demo: % — xoá % dòng', t.tbl, n;
                progress := TRUE;
            EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
                left_tbl := left_tbl || t.tbl::TEXT;
            END;
        END LOOP;
        EXIT WHEN cardinality(left_tbl) = 0;
        IF NOT progress OR rounds > 50 THEN
            RAISE EXCEPTION 'purge-demo: không xoá được (còn bị trỏ): %', left_tbl;
        END IF;
    END LOOP;
    -- Dòng trường giữ lại (trường có thật). Sĩ số / số lớp demo của 061 không còn cột riêng (207): nay tính
    -- từ lớp học và cơ sở, đã xoá ở trên.
END
$purge$;

DROP FUNCTION pg_temp.purge_collect(REGCLASS, TEXT, INT);
