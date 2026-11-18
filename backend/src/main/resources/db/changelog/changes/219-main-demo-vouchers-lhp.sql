--liquibase formatted sql

-- CHỈ Ở qltb_main: phiếu mẫu cho THPT chuyên Lê Hồng Phong (79000F01) để trình bày với tư vấn giám sát / Chủ đầu tư
-- theo các luồng của Kịch bản kiểm thử (L03–L08) — trưởng nhóm yêu cầu 12/11/2026.
--
-- Dùng PHÒNG, CÁN BỘ, THIẾT BỊ THẬT của trường (đã nhập từ tệp đầu vào), chọn theo trạng thái lúc chạy. Mỗi luồng có
-- phiếu đã xong (xem được lịch sử) và phiếu đang chờ một bước để bấm duyệt trực tiếp khi trình bày:
--   L03 ghi tăng   — 1 chờ hiệu trưởng duyệt (duyệt thì APP sinh tài sản, mã), 1 nháp.
--   L04 cấp phát   — 1 đã hoàn tất, 1 chờ duyệt (cấp phát từ kho nếu kho có tài sản, không thì điều chuyển nội bộ).
--   L05 mượn trả   — 1 đã trả, 1 đang mượn, 1 quá hạn.
--   L06 sửa chữa   — báo hỏng → tự sửa xong; báo hỏng → thuê sửa, phiếu sửa chờ duyệt chi phí.
--   L07 kiểm kê    — 1 biên bản đã duyệt cho một phòng (khớp sổ).
--   L08 mua sắm    — 1 đề xuất chờ Sở duyệt (đã qua hiệu trưởng), 1 đề xuất chờ hiệu trưởng.
-- Phiếu ghi đúng như app ghi: số phiếu theo bộ đếm, voucher_events, equipment_history, trạng thái / phòng / người giữ
-- của tài sản. Chưa có dữ liệu thiết bị của trường hoặc tài khoản trường (79000f01.cbtb01 / ht01) thì chưa chạy
-- (CONTINUE: lần triển khai sau kiểm lại). Đã có phiếu mẫu (ghi chú "[Phiếu mẫu]") thì không tạo lại.
--changeset qltb:219-main-demo-vouchers-lhp splitStatements:false
--preconditions onFail:CONTINUE onError:HALT
--precondition-sql-check expectedResult:1 SELECT CASE WHEN '${appStack}' = 'qltb_main' AND (SELECT count(*) FROM equipment e JOIN schools s ON s.id = e.school_id WHERE upper(s.code) = '79000F01') >= 30 AND (SELECT count(*) FROM users WHERE username IN ('79000f01.cbtb01', '79000f01.ht01')) = 2 THEN 1 ELSE 0 END
DO $demo$
#variable_conflict use_column
DECLARE
    tag     CONSTANT TEXT := '[Phiếu mẫu]';
    sid     BIGINT;
    cb      BIGINT;
    cb_name TEXT;
    ht      BIGINT;
    ht_name TEXT;
    t0      TIMESTAMPTZ := now();
    d0      DATE := current_date;
    store   BIGINT;
    teach   BIGINT[];
    used    BIGINT[] := '{}';
    items   BIGINT[];
    eid     BIGINT;
    vid     BIGINT;
    vid2    BIGINT;
    code    TEXT;
    code2   TEXT;
    n       INT;
    i       INT;
    room1   BIGINT;
    room2   BIGINT;
    kind    TEXT;
    rec     RECORD;
    cat1    RECORD;
    cat2    RECORD;
    sy      BIGINT;
    t_name  TEXT;
    -- Nhãn trạng thái / tình trạng như lịch sử app ghi.
    st_lbl  JSONB := '{"IN_STOCK":"Trong kho","IN_USE":"Đang sử dụng","BORROWED":"Đang cho mượn","BROKEN":"Hỏng, chờ xử lý","REPAIRING":"Đang sửa chữa"}';
    cd_lbl  JSONB := '{"TOT":"Tốt","KHA":"Khá","TRUNG_BINH":"Trung bình","KEM":"Kém","HONG":"Hỏng","KHONG_SU_DUNG":"Không sử dụng được"}';
BEGIN
    SELECT id INTO sid FROM schools WHERE upper(code) = '79000F01';
    SELECT id, full_name INTO cb, cb_name FROM users WHERE username = '79000f01.cbtb01';
    SELECT id, full_name INTO ht, ht_name FROM users WHERE username = '79000f01.ht01';
    IF EXISTS (SELECT 1 FROM equipment_loans WHERE school_id = sid AND note = tag) THEN
        RAISE NOTICE '219: đã có phiếu mẫu — bỏ qua';
        RETURN;
    END IF;

    SELECT r.id INTO store FROM rooms r JOIN room_types t ON t.id = r.room_type_id
    WHERE r.school_id = sid AND t.code = 'KHO' AND r.active
    ORDER BY (SELECT count(*) FROM equipment e WHERE e.room_id = r.id) DESC, r.id LIMIT 1;
    SELECT array_agg(id) INTO teach FROM (
        SELECT id FROM staff WHERE school_id = sid AND active IS NOT FALSE AND staff_type = 'TEACHER' ORDER BY id LIMIT 6) s;
    IF teach IS NULL OR array_length(teach, 1) < 3 THEN
        RAISE NOTICE '219: trường chưa đủ giáo viên — bỏ qua';
        RETURN;
    END IF;
    SELECT id INTO sy FROM school_years WHERE d0 BETWEEN start_date AND end_date ORDER BY start_date DESC LIMIT 1;
    IF sy IS NULL THEN
        SELECT id INTO sy FROM school_years WHERE start_date <= d0 ORDER BY start_date DESC LIMIT 1;
    END IF;

    -- Bảng tạm: tài sản bền (không theo lô), có nguồn kinh phí, có phòng, không nằm trên phiếu đang mở nào.
    CREATE TEMP TABLE demo_pool ON COMMIT DROP AS
    SELECT e.id, e.status, e.condition, e.room_id, e.manager_id
    FROM equipment e JOIN equipment_catalogs c ON c.id = e.catalog_id
    WHERE e.school_id = sid AND e.active IS NOT FALSE AND c.tracking_type <> 'BULK'
      AND coalesce(e.quantity, 1) = 1 AND e.funding_source IS NOT NULL AND e.room_id IS NOT NULL
      AND e.status IN ('IN_STOCK', 'IN_USE')
      AND NOT EXISTS (SELECT 1 FROM equipment_allocation_lines l JOIN equipment_allocations v ON v.id = l.allocation_id
                      WHERE l.equipment_id = e.id AND v.status IN ('DRAFT', 'PENDING', 'APPROVED'))
      AND NOT EXISTS (SELECT 1 FROM equipment_loan_lines l JOIN equipment_loans v ON v.id = l.loan_id
                      WHERE l.equipment_id = e.id AND v.status IN ('DRAFT', 'PENDING', 'APPROVED'))
      AND NOT EXISTS (SELECT 1 FROM repair_order_lines l JOIN repair_orders v ON v.id = l.order_id
                      WHERE l.equipment_id = e.id AND v.status IN ('DRAFT', 'PENDING', 'APPROVED'));

    -- =========================================================== L07 kiểm kê — một phòng, khớp sổ
    SELECT p.room_id INTO room1 FROM demo_pool p JOIN rooms r ON r.id = p.room_id
    WHERE p.status = 'IN_USE' AND r.active GROUP BY p.room_id HAVING count(*) BETWEEN 4 AND 25
    ORDER BY count(*) DESC, p.room_id LIMIT 1;
    IF room1 IS NOT NULL THEN
        SELECT array_agg(id ORDER BY id) INTO items FROM demo_pool WHERE room_id = room1 AND status = 'IN_USE';
        used := used || items;
        INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sid, 'KK-' || extract(year FROM d0 - 6), 1)
        ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
        RETURNING current_number INTO n;
        code := 'KK-' || extract(year FROM d0 - 6) || '-' || lpad(n::TEXT, 5, '0');
        INSERT INTO inventory_sessions (school_id, code, title, inventory_date, room_id, council, conclusion, status,
                                        reached_step, submitted_at, submitted_by_id, completed_at, completed_by_id, note,
                                        details, created_at, updated_at, created_by_id, updated_by_id)
        VALUES (sid, code, 'Kiểm kê định kỳ học kỳ I — ' || (SELECT name FROM rooms WHERE id = room1), d0 - 6, room1,
                'Tổ kiểm kê: ' || cb_name || ' (tổ trưởng)', 'Tài sản trong phòng khớp sổ, đủ số lượng, tình trạng như sổ.',
                'COMPLETED', 'SCHOOL', t0 - interval '6 days', cb, t0 - interval '6 days' + interval '2 hours', ht, tag,
                '{}', t0 - interval '6 days', t0 - interval '6 days' + interval '2 hours', cb, ht)
        RETURNING id INTO vid;
        i := 0;
        FOREACH eid IN ARRAY items LOOP
            i := i + 1;
            INSERT INTO inventory_lines (session_id, line_no, equipment_id, expected_room_id, expected_condition, found,
                                         found_room_id, found_condition, details)
            SELECT vid, i, e.id, e.room_id, e.condition, TRUE, e.room_id, e.condition, '{}' FROM equipment e WHERE e.id = eid;
            INSERT INTO equipment_history (equipment_id, action, voucher_resource, voucher_id, voucher_code, note, actor_id,
                                           actor_name, created_at)
            VALUES (eid, 'KIEM_KE', 'inventory_sessions', vid, code, 'Kiểm kê: khớp sổ', ht, ht_name,
                    t0 - interval '6 days' + interval '2 hours');
        END LOOP;
        INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, step, note, actor_id, actor_name, created_at) VALUES
            ('inventory_sessions', vid, 'SUBMIT', 'DRAFT', 'PENDING', NULL, NULL, cb, cb_name, t0 - interval '6 days'),
            ('inventory_sessions', vid, 'APPROVE', 'PENDING', 'APPROVED', 'SCHOOL', NULL, ht, ht_name, t0 - interval '6 days' + interval '2 hours'),
            ('inventory_sessions', vid, 'COMPLETE', 'APPROVED', 'COMPLETED', NULL, 'Đã ghi nhận kết quả kiểm kê', ht, ht_name,
             t0 - interval '6 days' + interval '2 hours');
    END IF;

    -- =========================================================== L04 cấp phát
    SELECT r.id INTO room1 FROM rooms r JOIN room_types t ON t.id = r.room_type_id
    WHERE r.school_id = sid AND r.active AND t.code = 'PHONG_HOC' ORDER BY r.code, r.id LIMIT 1;
    SELECT r.id INTO room2 FROM rooms r JOIN room_types t ON t.id = r.room_type_id
    WHERE r.school_id = sid AND r.active AND t.code = 'PHONG_HOC' AND r.id <> room1 ORDER BY r.code, r.id LIMIT 1;
    IF room1 IS NOT NULL AND room2 IS NOT NULL THEN
        IF (SELECT count(*) FROM demo_pool WHERE status = 'IN_STOCK' AND NOT (id = ANY (used))) >= 3 THEN
            kind := 'ALLOCATE';
        ELSE
            kind := 'RELOCATE';
        END IF;
        -- Phiếu đã hoàn tất: 2 tài sản về room1, người nhận là giáo viên đầu.
        SELECT array_agg(id ORDER BY id) INTO items FROM (
            SELECT id FROM demo_pool WHERE status = CASE kind WHEN 'ALLOCATE' THEN 'IN_STOCK' ELSE 'IN_USE' END
              AND room_id <> room1 AND NOT (id = ANY (used)) ORDER BY id LIMIT 2) x;
        IF array_length(items, 1) = 2 THEN
            used := used || items;
            INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sid, 'CP-' || extract(year FROM d0 - 5), 1)
            ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
            RETURNING current_number INTO n;
            code := 'CP-' || extract(year FROM d0 - 5) || '-' || lpad(n::TEXT, 5, '0');
            INSERT INTO equipment_allocations (school_id, code, kind, allocation_date, room_id, receiver_id, purpose, status,
                                               reached_step, submitted_at, submitted_by_id, completed_at, completed_by_id,
                                               note, details, created_at, updated_at, created_by_id, updated_by_id)
            VALUES (sid, code, kind, d0 - 5, room1, teach[1],
                    CASE kind WHEN 'ALLOCATE' THEN 'Cấp phát thiết bị phục vụ dạy học' ELSE 'Chuyển thiết bị về phòng học' END,
                    'COMPLETED', 'SCHOOL', t0 - interval '5 days', cb, t0 - interval '5 days' + interval '3 hours', cb, tag, '{}',
                    t0 - interval '5 days', t0 - interval '5 days' + interval '3 hours', cb, cb)
            RETURNING id INTO vid;
            i := 0;
            FOREACH eid IN ARRAY items LOOP
                i := i + 1;
                SELECT p.*, (SELECT name FROM rooms WHERE id = p.room_id) AS room_name,
                       (SELECT name FROM staff WHERE id = p.manager_id) AS manager_name INTO rec
                FROM demo_pool p WHERE p.id = eid;
                INSERT INTO equipment_allocation_lines (allocation_id, line_no, equipment_id, quantity, stock_before, details)
                VALUES (vid, i, eid, 1, 1, '{}');
                INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, voucher_resource, voucher_id,
                                               voucher_code, note, actor_id, actor_name, created_at)
                VALUES (eid, CASE kind WHEN 'ALLOCATE' THEN 'CAP_PHAT' ELSE 'DIEU_CHUYEN' END, 'room', rec.room_name,
                        (SELECT name FROM rooms WHERE id = room1), 'equipment_allocations', vid, code,
                        CASE kind WHEN 'ALLOCATE' THEN 'Cấp phát theo phiếu ' ELSE 'Điều chuyển nội bộ theo phiếu ' END || code,
                        cb, cb_name, t0 - interval '5 days' + interval '3 hours');
                IF rec.manager_id IS DISTINCT FROM teach[1] THEN
                    INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, voucher_resource, voucher_id,
                                                   voucher_code, note, actor_id, actor_name, created_at)
                    VALUES (eid, CASE kind WHEN 'ALLOCATE' THEN 'CAP_PHAT' ELSE 'DIEU_CHUYEN' END, 'manager', rec.manager_name,
                            (SELECT name FROM staff WHERE id = teach[1]), 'equipment_allocations', vid, code,
                            CASE kind WHEN 'ALLOCATE' THEN 'Cấp phát theo phiếu ' ELSE 'Điều chuyển nội bộ theo phiếu ' END || code,
                            cb, cb_name, t0 - interval '5 days' + interval '3 hours');
                END IF;
                IF rec.status <> 'IN_USE' THEN
                    INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, voucher_resource, voucher_id,
                                                   voucher_code, note, actor_id, actor_name, created_at)
                    VALUES (eid, 'CAP_PHAT', 'status', st_lbl ->> rec.status, st_lbl ->> 'IN_USE', 'equipment_allocations', vid,
                            code, 'Cấp phát theo phiếu ' || code, cb, cb_name, t0 - interval '5 days' + interval '3 hours');
                END IF;
                UPDATE equipment SET room_id = room1, manager_id = teach[1], status = 'IN_USE', updated_at = t0,
                                     updated_by_id = cb WHERE id = eid;
            END LOOP;
            INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, step, note, actor_id, actor_name, created_at) VALUES
                ('equipment_allocations', vid, 'SUBMIT', 'DRAFT', 'PENDING', NULL, NULL, cb, cb_name, t0 - interval '5 days'),
                ('equipment_allocations', vid, 'APPROVE', 'PENDING', 'APPROVED', 'SCHOOL', NULL, ht, ht_name,
                 t0 - interval '5 days' + interval '1 hour'),
                ('equipment_allocations', vid, 'COMPLETE', 'APPROVED', 'COMPLETED', NULL, NULL, cb, cb_name,
                 t0 - interval '5 days' + interval '3 hours');
        END IF;
        -- Phiếu chờ hiệu trưởng duyệt: 1 tài sản về room2.
        SELECT id INTO eid FROM demo_pool WHERE status = CASE kind WHEN 'ALLOCATE' THEN 'IN_STOCK' ELSE 'IN_USE' END
          AND room_id <> room2 AND NOT (id = ANY (used)) ORDER BY id LIMIT 1;
        IF eid IS NOT NULL THEN
            used := used || eid;
            INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sid, 'CP-' || extract(year FROM d0), 1)
            ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
            RETURNING current_number INTO n;
            code := 'CP-' || extract(year FROM d0) || '-' || lpad(n::TEXT, 5, '0');
            INSERT INTO equipment_allocations (school_id, code, kind, allocation_date, room_id, receiver_id, purpose, status,
                                               approval_step, reached_step, submitted_at, submitted_by_id, note, details,
                                               created_at, updated_at, created_by_id, updated_by_id)
            VALUES (sid, code, kind, d0, room2, teach[2],
                    CASE kind WHEN 'ALLOCATE' THEN 'Cấp phát thiết bị phục vụ dạy học' ELSE 'Chuyển thiết bị về phòng học' END,
                    'PENDING', 'SCHOOL', 'SCHOOL', t0 - interval '1 hour', cb, tag, '{}', t0 - interval '1 hour',
                    t0 - interval '1 hour', cb, cb)
            RETURNING id INTO vid;
            INSERT INTO equipment_allocation_lines (allocation_id, line_no, equipment_id, quantity, details) VALUES (vid, 1, eid, 1, '{}');
            INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, actor_id, actor_name, created_at)
            VALUES ('equipment_allocations', vid, 'SUBMIT', 'DRAFT', 'PENDING', cb, cb_name, t0 - interval '1 hour');
        END IF;
    END IF;

    -- =========================================================== L05 mượn trả — đã trả / đang mượn / quá hạn
    FOR rec IN
        SELECT * FROM (VALUES
            (1, 'COMPLETED', 5, 3, 1, teach[3], 'Tiết thực hành'),
            (2, 'APPROVED', 1, -2, 2, teach[4], 'Tiết dạy lý thuyết'),
            (3, 'APPROVED', 7, 2, 1, teach[5], 'Tiết thực hành')
        ) AS v(no, status, ago, due_ago, cnt, borrower, purpose)
    LOOP
        SELECT array_agg(id ORDER BY id) INTO items FROM (
            SELECT id FROM demo_pool WHERE status = 'IN_USE' AND NOT (id = ANY (used)) ORDER BY id DESC LIMIT rec.cnt) x;
        CONTINUE WHEN items IS NULL OR rec.borrower IS NULL;
        used := used || items;
        SELECT name INTO t_name FROM staff WHERE id = rec.borrower;
        INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sid, 'MT-' || extract(year FROM d0 - rec.ago), 1)
        ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
        RETURNING current_number INTO n;
        code := 'MT-' || extract(year FROM d0 - rec.ago) || '-' || lpad(n::TEXT, 5, '0');
        INSERT INTO equipment_loans (school_id, code, borrower_id, loan_date, due_date, purpose, returned_date, status,
                                     submitted_at, submitted_by_id, completed_at, completed_by_id, note, details, created_at,
                                     updated_at, created_by_id, updated_by_id, loan_slot, due_slot, returned_slot,
                                     purpose_type, lesson_content)
        VALUES (sid, code, rec.borrower, d0 - rec.ago, d0 - rec.due_ago, rec.purpose,
                CASE WHEN rec.status = 'COMPLETED' THEN d0 - rec.due_ago END, rec.status,
                t0 - make_interval(days => rec.ago), cb,
                CASE WHEN rec.status = 'COMPLETED' THEN t0 - make_interval(days => rec.due_ago) END,
                CASE WHEN rec.status = 'COMPLETED' THEN cb END, tag, '{"borrowerType": "TEACHER"}',
                t0 - make_interval(days => rec.ago), t0 - make_interval(days => least(rec.ago, greatest(rec.due_ago, 0))), cb, cb,
                'MORNING', 'AFTERNOON', CASE WHEN rec.status = 'COMPLETED' THEN 'AFTERNOON' END,
                CASE WHEN rec.purpose = 'Tiết thực hành' THEN 'PRACTICE' ELSE 'THEORY' END, rec.purpose)
        RETURNING id INTO vid;
        i := 0;
        FOREACH eid IN ARRAY items LOOP
            i := i + 1;
            INSERT INTO equipment_loan_lines (loan_id, line_no, equipment_id, status_before, returned_date, return_outcome,
                                              returned_slot, details)
            SELECT vid, i, e.id, 'IN_USE', CASE WHEN rec.status = 'COMPLETED' THEN d0 - rec.due_ago END,
                   CASE WHEN rec.status = 'COMPLETED' THEN 'GOOD' END,
                   CASE WHEN rec.status = 'COMPLETED' THEN 'AFTERNOON' END,
                   jsonb_build_object('conditionOnBorrow', coalesce(e.condition, 'TOT'))
            FROM equipment e WHERE e.id = eid;
            INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, voucher_resource, voucher_id,
                                           voucher_code, note, actor_id, actor_name, created_at)
            VALUES (eid, 'MUON', 'status', st_lbl ->> 'IN_USE', st_lbl ->> 'BORROWED', 'equipment_loans', vid, code,
                    'Cho ' || t_name || ' mượn, hạn trả ' || to_char(d0 - rec.due_ago, 'DD/MM/YYYY'), cb, cb_name,
                    t0 - make_interval(days => rec.ago));
            IF rec.status = 'COMPLETED' THEN
                INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, voucher_resource, voucher_id,
                                               voucher_code, note, actor_id, actor_name, created_at)
                VALUES (eid, 'TRA', 'status', st_lbl ->> 'BORROWED', st_lbl ->> 'IN_USE', 'equipment_loans', vid, code,
                        'Trả bình thường', cb, cb_name, t0 - make_interval(days => rec.due_ago));
            ELSE
                UPDATE equipment SET status = 'BORROWED', updated_at = t0, updated_by_id = cb WHERE id = eid;
            END IF;
        END LOOP;
        INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, actor_id, actor_name, created_at)
        VALUES ('equipment_loans', vid, 'SUBMIT', 'DRAFT', 'APPROVED', cb, cb_name, t0 - make_interval(days => rec.ago));
        IF rec.status = 'COMPLETED' THEN
            INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, note, actor_id, actor_name, created_at)
            VALUES ('equipment_loans', vid, 'COMPLETE', 'APPROVED', 'COMPLETED', 'Đã trả đủ', cb, cb_name,
                    t0 - make_interval(days => rec.due_ago));
        END IF;
    END LOOP;

    -- =========================================================== L06 báo hỏng → sửa chữa
    -- (1) tự sửa, đã xong; (2) thuê sửa, phiếu sửa chờ hiệu trưởng duyệt chi phí.
    FOR rec IN
        SELECT * FROM (VALUES
            (1, 4, 'SELF_REPAIR', 'Không lên nguồn', NULL::TEXT, NULL::NUMERIC),
            (2, 1, 'OUTSOURCE', 'Màn hình chập chờn, mất tín hiệu', 'Công ty TNHH Thiết bị Giáo dục Sài Gòn', 350000::NUMERIC)
        ) AS v(no, ago, handling, descr, vendor, cost)
    LOOP
        SELECT id INTO eid FROM demo_pool WHERE status = 'IN_USE' AND NOT (id = ANY (used)) ORDER BY id DESC LIMIT 1;
        CONTINUE WHEN eid IS NULL;
        used := used || eid;
        SELECT condition INTO kind FROM equipment WHERE id = eid;
        INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sid, 'BX-' || extract(year FROM d0 - rec.ago), 1)
        ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
        RETURNING current_number INTO n;
        code := 'BX-' || extract(year FROM d0 - rec.ago) || '-' || lpad(n::TEXT, 5, '0');
        INSERT INTO damage_reports (school_id, code, report_date, reporter_id, description, handling, vendor, status,
                                    submitted_at, submitted_by_id, completed_at, completed_by_id, note, details, created_at,
                                    updated_at, created_by_id, updated_by_id)
        VALUES (sid, code, d0 - rec.ago, teach[6], rec.descr, rec.handling, rec.vendor, 'COMPLETED',
                t0 - make_interval(days => rec.ago), cb, t0 - make_interval(days => rec.ago), cb, tag, '{}',
                t0 - make_interval(days => rec.ago), t0 - make_interval(days => rec.ago), cb, cb)
        RETURNING id INTO vid;
        INSERT INTO damage_report_lines (report_id, line_no, equipment_id, details) VALUES (vid, 1, eid, '{}');
        INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, voucher_resource, voucher_id,
                                       voucher_code, note, actor_id, actor_name, created_at) VALUES
            (eid, 'BAO_HONG', 'condition', cd_lbl ->> coalesce(kind, 'TOT'), cd_lbl ->> 'HONG', 'damage_reports', vid, code,
             'Báo hỏng: ' || rec.descr, cb, cb_name, t0 - make_interval(days => rec.ago)),
            (eid, 'BAO_HONG', 'status', st_lbl ->> 'IN_USE', st_lbl ->> 'BROKEN', 'damage_reports', vid, code,
             'Báo hỏng: ' || rec.descr, cb, cb_name, t0 - make_interval(days => rec.ago));
        INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, note, actor_id, actor_name, created_at) VALUES
            ('damage_reports', vid, 'SUBMIT', 'DRAFT', 'APPROVED', NULL, cb, cb_name, t0 - make_interval(days => rec.ago)),
            ('damage_reports', vid, 'COMPLETE', 'APPROVED', 'COMPLETED', 'Đã lập phiếu sửa chữa nháp', cb, cb_name,
             t0 - make_interval(days => rec.ago));
        code2 := code;
        INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sid, 'SC-' || extract(year FROM d0 - rec.ago), 1)
        ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
        RETURNING current_number INTO n;
        code := 'SC-' || extract(year FROM d0 - rec.ago) || '-' || lpad(n::TEXT, 5, '0');
        IF rec.no = 1 THEN
            INSERT INTO repair_orders (school_id, code, request_date, repair_type, damage_description, start_date,
                                       completed_date, cost_actual, result, condition_after, result_note, source_resource,
                                       source_id, source_code, status, submitted_at, submitted_by_id, completed_at,
                                       completed_by_id, note, details, created_at, updated_at, created_by_id, updated_by_id,
                                       work_kind)
            VALUES (sid, code, d0 - rec.ago, 'ON_SITE', rec.descr, d0 - rec.ago, d0 - rec.ago + 1, 0, 'REPAIRED', 'TOT',
                    'Thay cầu chì, kiểm tra lại hoạt động bình thường', 'damage_reports', vid, code2, 'COMPLETED',
                    t0 - make_interval(days => rec.ago), cb, t0 - make_interval(days => rec.ago - 1), cb, tag, '{}',
                    t0 - make_interval(days => rec.ago), t0 - make_interval(days => rec.ago - 1), cb, cb, 'REPAIR')
            RETURNING id INTO vid2;
            INSERT INTO repair_order_lines (order_id, line_no, equipment_id, status_before, details) VALUES (vid2, 1, eid, 'BROKEN', '{}');
            INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, voucher_resource, voucher_id,
                                           voucher_code, note, actor_id, actor_name, created_at) VALUES
                (eid, 'SUA_CHUA', 'status', st_lbl ->> 'BROKEN', st_lbl ->> 'REPAIRING', 'repair_orders', vid2, code,
                 'Đưa đi sửa', cb, cb_name, t0 - make_interval(days => rec.ago)),
                (eid, 'SUA_CHUA', 'condition', cd_lbl ->> 'HONG', cd_lbl ->> 'TOT', 'repair_orders', vid2, code,
                 'Sửa xong', cb, cb_name, t0 - make_interval(days => rec.ago - 1)),
                (eid, 'SUA_CHUA', 'status', st_lbl ->> 'REPAIRING', st_lbl ->> 'IN_USE', 'repair_orders', vid2, code,
                 'Sửa xong, đưa vào sử dụng lại', cb, cb_name, t0 - make_interval(days => rec.ago - 1));
            INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, note, actor_id, actor_name, created_at) VALUES
                ('repair_orders', vid2, 'SUBMIT', 'DRAFT', 'APPROVED', NULL, cb, cb_name, t0 - make_interval(days => rec.ago)),
                ('repair_orders', vid2, 'COMPLETE', 'APPROVED', 'COMPLETED', 'Sửa xong', cb, cb_name,
                 t0 - make_interval(days => rec.ago - 1));
            UPDATE equipment SET condition = 'TOT', status = 'IN_USE', updated_at = t0, updated_by_id = cb WHERE id = eid;
        ELSE
            INSERT INTO repair_orders (school_id, code, request_date, repair_type, vendor, damage_description, cost_estimated,
                                       source_resource, source_id, source_code, status, approval_step, reached_step,
                                       submitted_at, submitted_by_id, note, details, created_at, updated_at, created_by_id,
                                       updated_by_id, work_kind)
            VALUES (sid, code, d0 - rec.ago, 'OUTSOURCED', rec.vendor, rec.descr, rec.cost, 'damage_reports', vid, code2,
                    'PENDING', 'SCHOOL', 'SCHOOL', t0 - interval '3 hours', cb, tag, '{}', t0 - make_interval(days => rec.ago),
                    t0 - interval '3 hours', cb, cb, 'REPAIR')
            RETURNING id INTO vid2;
            INSERT INTO repair_order_lines (order_id, line_no, equipment_id, status_before, details) VALUES (vid2, 1, eid, 'BROKEN', '{}');
            INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, actor_id, actor_name, created_at)
            VALUES ('repair_orders', vid2, 'SUBMIT', 'DRAFT', 'PENDING', cb, cb_name, t0 - interval '3 hours');
            UPDATE equipment SET condition = 'HONG', status = 'BROKEN', updated_at = t0, updated_by_id = cb WHERE id = eid;
        END IF;
    END LOOP;

    -- =========================================================== L03 ghi tăng, L08 đề xuất mua sắm
    -- Hai nhóm thiết bị vật lý theo dõi từng chiếc mà trường đang có nhiều nhất, giá 2–40 triệu (đơn giá = giá trung
    -- bình trường đang ghi; bỏ dòng giá bất thường của dữ liệu nhập).
    FOR rec IN
        SELECT c.id, c.name, u.name AS unit_name, round(avg(e.original_value), -3) AS price, count(*) AS have,
               row_number() OVER (ORDER BY count(*) DESC, c.id) AS rn
        FROM equipment e JOIN equipment_catalogs c ON c.id = e.catalog_id JOIN units u ON u.id = c.unit_id
        WHERE e.school_id = sid AND c.tracking_type = 'SERIAL' AND coalesce(c.physical_or_digital, 'PHYSICAL') = 'PHYSICAL'
          AND e.original_value BETWEEN 2000000 AND 40000000
        GROUP BY c.id, c.name, u.name
        ORDER BY count(*) DESC, c.id LIMIT 2
    LOOP
        IF rec.rn = 1 THEN cat1 := rec; ELSE cat2 := rec; END IF;
    END LOOP;

    IF cat1.id IS NOT NULL AND cat2.id IS NOT NULL THEN
        -- L03: phiếu chờ hiệu trưởng duyệt (mua sắm, ngân sách nhà nước, nhận vào kho).
        INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sid, 'NK-' || extract(year FROM d0 - 1), 1)
        ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
        RETURNING current_number INTO n;
        code := 'NK-' || extract(year FROM d0 - 1) || '-' || lpad(n::TEXT, 5, '0');
        INSERT INTO equipment_intakes (school_id, code, intake_date, document_no, document_date, supplier, funding_source,
                                       origin_source_id, acquisition_method_id, warranty_months, note, status, approval_step,
                                       reached_step, submitted_at, submitted_by_id, details, school_year_id, created_at,
                                       updated_at, created_by_id, updated_by_id)
        VALUES (sid, code, d0 - 1, '45/2026/HĐMB', d0 - 3, 'Công ty CP Thiết bị Giáo dục Miền Nam', 'STATE_BUDGET',
                (SELECT id FROM origin_sources WHERE code = 'MUA_SAM'), (SELECT id FROM acquisition_methods WHERE code = 'MUA_TRUC_TIEP'),
                12, tag, 'PENDING', 'SCHOOL', 'SCHOOL', t0 - interval '2 hours', cb,
                '{"deliveredBy": "Công ty CP Thiết bị Giáo dục Miền Nam"}', sy, t0 - interval '1 day', t0 - interval '2 hours', cb, cb)
        RETURNING id INTO vid;
        INSERT INTO equipment_intake_lines (intake_id, line_no, catalog_id, name, physical_or_digital, document_quantity,
                                            received_quantity, unit_price, room_id, generated_count, details, created_at,
                                            created_by_id)
        VALUES (vid, 1, cat1.id, cat1.name, 'PHYSICAL', 2, 2, cat1.price, store, 0, '{}', t0 - interval '1 day', cb),
               (vid, 2, cat2.id, cat2.name, 'PHYSICAL', 3, 3, cat2.price, store, 0, '{}', t0 - interval '1 day', cb);
        INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, actor_id, actor_name, created_at)
        VALUES ('equipment_intakes', vid, 'SUBMIT', 'DRAFT', 'PENDING', cb, cb_name, t0 - interval '2 hours');

        -- L03: phiếu nháp (chưa có số — số cấp lúc trình).
        INSERT INTO equipment_intakes (school_id, intake_date, supplier, funding_source, origin_source_id, note, status,
                                       details, school_year_id, created_at, updated_at, created_by_id, updated_by_id)
        VALUES (sid, d0, 'Hội Cha mẹ học sinh', 'SPONSORSHIP', (SELECT id FROM origin_sources WHERE code = 'TANG_TAI_TRO'),
                tag, 'DRAFT', '{}', sy, t0, t0, cb, cb)
        RETURNING id INTO vid;
        INSERT INTO equipment_intake_lines (intake_id, line_no, catalog_id, name, physical_or_digital, document_quantity,
                                            received_quantity, unit_price, room_id, generated_count, details, created_at,
                                            created_by_id)
        VALUES (vid, 1, cat2.id, cat2.name, 'PHYSICAL', 1, 1, cat2.price, store, 0, '{}', t0, cb);

        -- L08: đề xuất trên 100 triệu — hiệu trưởng đã duyệt, chờ Sở (cơ quan quản lý của trường).
        INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sid, 'MS-' || extract(year FROM d0 - 4), 1)
        ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
        RETURNING current_number INTO n;
        code := 'MS-' || extract(year FROM d0 - 4) || '-' || lpad(n::TEXT, 5, '0');
        INSERT INTO purchase_proposals (school_id, code, proposal_date, budget_year, funding_source, reason, status,
                                        approval_step, reached_step, submitted_at, submitted_by_id, note, details, created_at,
                                        updated_at, created_by_id, updated_by_id)
        VALUES (sid, code, d0 - 4, extract(year FROM d0)::INT + 1, 'STATE_BUDGET',
                'Bổ sung thiết bị cho phòng bộ môn, thay thế thiết bị đã xuống cấp sau nhiều năm sử dụng', 'PENDING',
                'MANAGING_BODY', 'MANAGING_BODY', t0 - interval '4 days', cb, tag, '{}', t0 - interval '4 days',
                t0 - interval '3 days', cb, ht)
        RETURNING id INTO vid;
        INSERT INTO purchase_proposal_lines (proposal_id, line_no, kind, catalog_id, name, unit_name, quantity, unit_price,
                                             priority, current_quantity, details)
        VALUES (vid, 1, 'NEW', cat1.id, cat1.name, cat1.unit_name,
                greatest(2, ceil(80000000 / greatest(cat1.price, 1)))::INT, cat1.price, 1, cat1.have, '{}'),
               (vid, 2, 'NEW', cat2.id, cat2.name, cat2.unit_name,
                greatest(2, ceil(40000000 / greatest(cat2.price, 1)))::INT, cat2.price, 2, cat2.have, '{}');
        INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, step, actor_id, actor_name, created_at) VALUES
            ('purchase_proposals', vid, 'SUBMIT', 'DRAFT', 'PENDING', NULL, cb, cb_name, t0 - interval '4 days'),
            ('purchase_proposals', vid, 'APPROVE', 'PENDING', 'PENDING', 'SCHOOL', ht, ht_name, t0 - interval '3 days');

        -- L08: đề xuất nhỏ, chờ hiệu trưởng duyệt.
        INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sid, 'MS-' || extract(year FROM d0), 1)
        ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
        RETURNING current_number INTO n;
        code := 'MS-' || extract(year FROM d0) || '-' || lpad(n::TEXT, 5, '0');
        INSERT INTO purchase_proposals (school_id, code, proposal_date, budget_year, funding_source, reason, status,
                                        approval_step, reached_step, submitted_at, submitted_by_id, note, details, created_at,
                                        updated_at, created_by_id, updated_by_id)
        VALUES (sid, code, d0, extract(year FROM d0)::INT + 1, 'STATE_BUDGET', 'Thay thế thiết bị hỏng không sửa được',
                'PENDING', 'SCHOOL', 'SCHOOL', t0 - interval '30 minutes', cb, tag, '{}', t0 - interval '30 minutes',
                t0 - interval '30 minutes', cb, cb)
        RETURNING id INTO vid;
        INSERT INTO purchase_proposal_lines (proposal_id, line_no, kind, catalog_id, name, unit_name, quantity, unit_price,
                                             priority, current_quantity, details)
        VALUES (vid, 1, 'NEW', cat2.id, cat2.name, cat2.unit_name, 1, cat2.price, 1, cat2.have, '{}');
        INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, actor_id, actor_name, created_at)
        VALUES ('purchase_proposals', vid, 'SUBMIT', 'DRAFT', 'PENDING', cb, cb_name, t0 - interval '30 minutes');
    END IF;

    RAISE NOTICE '219: đã tạo phiếu mẫu cho trường %', sid;
END
$demo$;
