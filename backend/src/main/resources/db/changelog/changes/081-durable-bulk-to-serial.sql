--liquibase formatted sql

-- Mặt hàng BỀN (bàn ghế, bản đồ, tranh, giá vẽ, tai nghe, kính lúp, bộ vẽ hình học...) từng bị
-- quản lý THEO SỐ LƯỢNG — 40 cái bàn là một con số trong equipment_stock, không có mã, không
-- mở được hồ sơ cái nào. Quy tắc đúng: chỉ VẬT TƯ TIÊU HAO (asset_category SUPPLY / CHEMICAL)
-- được đếm theo số lượng; mọi thứ khác là tài sản từng cái, mỗi cái một mã chuẩn
-- TT.TR.MH.LT.ST.NC. EquipmentCatalogService.requireTrackingFitsCategory chặn từ nay về sau;
-- còn dữ liệu đã có thì sửa ở đây.
--
-- Mỗi dòng tồn kho của mặt hàng bền được đổi thành đúng từng ấy tài sản, gắn về các dòng phiếu
-- nhập đã sinh ra nó (cùng trường, mặt hàng, phòng — cũ trước), ngày / giá / nguồn lấy theo
-- phiếu như EquipmentService.generateFromIntakeLine, có lịch sử GHI_TANG. Phần không truy được
-- về phiếu nào (khai tay, dữ liệu cũ) thành tài sản không phiếu, ngày tiếp nhận là ngày dòng tồn
-- kho được tạo. Mã lấy từ đúng bộ đếm equipment_code_sequences (ST ba chữ số — xem 082); bộ đếm nào hết 999 số thì phần dư
-- ở lại tồn kho và mặt hàng đó CHƯA đổi cách quản lý — không đánh mất con số nào.

--changeset qltb:081-durable-bulk-to-serial splitStatements:false
--comment Đổi tồn kho của mặt hàng bền (không phải vật tư / hoá chất) thành tài sản từng cái có mã chuẩn, rồi chuyển các mặt hàng đó sang quản lý từng cái.
DO $$
DECLARE
    st RECORD;
    ln RECORD;
    v_left INT;
    v_take INT;
    v_num INT;
    v_code TEXT;
    v_key TEXT;
    v_mh TEXT;
    v_lt TEXT;
    v_date DATE;
    v_store BOOLEAN;
    v_eq_id BIGINT;
    v_short TEXT;
    v_prov CONSTANT TEXT := '79';
BEGIN
    FOR st IN
        SELECT s.id, s.school_id, s.catalog_id, s.room_id, s.quantity, s.created_at,
               c.name AS catalog_name, c.unit_id, c.physical_or_digital, c.asset_category,
               sj.teaching_code, upper(trim(sc.short_code)) AS tr,
               (s.room_id IS NULL OR rt.code = 'KHO') AS in_store
        FROM equipment_stock s
        JOIN equipment_catalogs c ON c.id = s.catalog_id
        JOIN schools sc ON sc.id = s.school_id
        LEFT JOIN subjects sj ON sj.id = c.subject_id
        LEFT JOIN rooms r ON r.id = s.room_id
        LEFT JOIN room_types rt ON rt.id = r.room_type_id
        WHERE c.tracking_type = 'BULK'
          AND coalesce(c.asset_category, '') NOT IN ('SUPPLY', 'CHEMICAL')
          AND s.quantity > 0
        ORDER BY s.school_id, s.catalog_id, s.id
    LOOP
        IF st.tr IS NULL OR st.tr !~ '^[A-Z0-9]{2}$' THEN
            RAISE NOTICE '081: trường % chưa có mã TR, giữ % trong tồn kho', st.school_id, st.quantity;
            CONTINUE;
        END IF;
        v_left := st.quantity;
        v_mh := coalesce(nullif(trim(st.teaching_code), ''), '00');
        v_lt := CASE WHEN st.physical_or_digital = 'DIGITAL' THEN 'PM' ELSE 'TB' END;

        -- Các dòng phiếu nhập đã cộng vào đúng chỗ này, cũ trước; chưa sinh tài sản nào từ chúng.
        FOR ln IN
            SELECT l.id AS line_id, l.name, l.unit_price, l.received_quantity, l.line_no,
                   i.id AS intake_id, i.code AS intake_code, i.intake_date, i.document_date,
                   i.funding_source, i.origin_source_id, i.acquisition_method_id, i.warranty_months,
                   i.confirmed_by_id, u.full_name AS actor_name
            FROM equipment_intake_lines l
            JOIN equipment_intakes i ON i.id = l.intake_id
            LEFT JOIN users u ON u.id = i.confirmed_by_id
            WHERE i.status = 'COMPLETED' AND i.school_id = st.school_id AND l.catalog_id = st.catalog_id
              AND l.room_id IS NOT DISTINCT FROM st.room_id
              AND NOT EXISTS (SELECT 1 FROM equipment e WHERE e.intake_line_id = l.id)
            ORDER BY i.intake_date, l.id
        LOOP
            EXIT WHEN v_left <= 0;
            v_take := least(v_left, ln.received_quantity);
            v_date := ln.intake_date;
            v_key := v_prov || '.' || st.tr || '.' || v_mh || '.' || v_lt || '.' || to_char(v_date, 'YY');
            FOR k IN 1..v_take LOOP
                INSERT INTO equipment_code_sequences (school_id, code_prefix, current_number) VALUES (st.school_id, v_key, 1)
                ON CONFLICT (school_id, code_prefix) DO UPDATE SET current_number = equipment_code_sequences.current_number + 1
                RETURNING current_number INTO v_num;
                IF v_num > 999 THEN
                    UPDATE equipment_code_sequences SET current_number = 999 WHERE school_id = st.school_id AND code_prefix = v_key;
                    EXIT;
                END IF;
                v_code := v_prov || '.' || st.tr || '.' || v_mh || '.' || v_lt || '.' || lpad(v_num::text, 3, '0') || '.' || to_char(v_date, 'YY');
                INSERT INTO equipment (school_id, code, name, active, catalog_id, physical_or_digital, asset_category, unit_id,
                                       quantity, origin_source_id, acquisition_method_id, funding_source, usage_start_year,
                                       received_date, purchase_date, original_value, remaining_value, warranty_expiry,
                                       room_id, condition, status, specs, intake_line_id, created_at, created_by_id)
                VALUES (st.school_id, v_code, ln.name, TRUE, st.catalog_id, coalesce(st.physical_or_digital, 'PHYSICAL'),
                        st.asset_category, st.unit_id, 1, ln.origin_source_id, ln.acquisition_method_id, ln.funding_source,
                        extract(YEAR FROM v_date)::int, v_date, ln.document_date, ln.unit_price, ln.unit_price,
                        CASE WHEN ln.warranty_months IS NULL THEN NULL ELSE (v_date + make_interval(months => ln.warranty_months))::date END,
                        st.room_id, 'TOT', CASE WHEN st.in_store THEN 'IN_STOCK' ELSE 'IN_USE' END, '{}'::jsonb, ln.line_id,
                        now(), ln.confirmed_by_id)
                RETURNING id INTO v_eq_id;
                INSERT INTO equipment_history (equipment_id, action, voucher_resource, voucher_id, voucher_code, note,
                                               actor_id, actor_name, created_at)
                VALUES (v_eq_id, 'GHI_TANG', 'equipment_intakes', ln.intake_id, ln.intake_code,
                        'Ghi tăng theo phiếu nhập, dòng ' || ln.line_no || ' (cấp mã từng cái khi bỏ quản lý theo số lượng)',
                        ln.confirmed_by_id, ln.actor_name, now());
                v_left := v_left - 1;
            END LOOP;
            EXIT WHEN v_num > 999;
        END LOOP;

        -- Phần không truy được về phiếu nhập nào.
        IF v_left > 0 AND (v_num IS NULL OR v_num <= 999) THEN
            v_date := st.created_at::date;
            v_key := v_prov || '.' || st.tr || '.' || v_mh || '.' || v_lt || '.' || to_char(v_date, 'YY');
            WHILE v_left > 0 LOOP
                INSERT INTO equipment_code_sequences (school_id, code_prefix, current_number) VALUES (st.school_id, v_key, 1)
                ON CONFLICT (school_id, code_prefix) DO UPDATE SET current_number = equipment_code_sequences.current_number + 1
                RETURNING current_number INTO v_num;
                IF v_num > 999 THEN
                    UPDATE equipment_code_sequences SET current_number = 999 WHERE school_id = st.school_id AND code_prefix = v_key;
                    EXIT;
                END IF;
                v_code := v_prov || '.' || st.tr || '.' || v_mh || '.' || v_lt || '.' || lpad(v_num::text, 3, '0') || '.' || to_char(v_date, 'YY');
                INSERT INTO equipment (school_id, code, name, active, catalog_id, physical_or_digital, asset_category, unit_id,
                                       quantity, usage_start_year, received_date, room_id, condition, status, specs, note, created_at)
                VALUES (st.school_id, v_code, st.catalog_name, TRUE, st.catalog_id, coalesce(st.physical_or_digital, 'PHYSICAL'),
                        st.asset_category, st.unit_id, 1, extract(YEAR FROM v_date)::int, v_date, st.room_id, 'TOT',
                        CASE WHEN st.in_store THEN 'IN_STOCK' ELSE 'IN_USE' END, '{}'::jsonb,
                        'Cấp mã từng cái khi bỏ quản lý theo số lượng — chưa rõ phiếu nhập', now())
                RETURNING id INTO v_eq_id;
                INSERT INTO equipment_history (equipment_id, action, note, created_at)
                VALUES (v_eq_id, 'GHI_TANG', 'Cấp mã từng cái khi bỏ quản lý theo số lượng (không truy được phiếu nhập)', now());
                v_left := v_left - 1;
            END LOOP;
        END IF;

        IF v_left <= 0 THEN
            DELETE FROM equipment_stock WHERE id = st.id;
        ELSE
            UPDATE equipment_stock SET quantity = v_left, updated_at = now() WHERE id = st.id;
            RAISE NOTICE '081: hết số thứ tự mã, còn % của mặt hàng % ở lại tồn kho (trường %)', v_left, st.catalog_id, st.school_id;
        END IF;
        v_num := NULL;
    END LOOP;

    -- Đổi cách quản lý của những mặt hàng bền đã không còn tồn kho nào.
    UPDATE equipment_catalogs c SET tracking_type = 'SERIAL', updated_at = now()
    WHERE c.tracking_type = 'BULK'
      AND coalesce(c.asset_category, '') NOT IN ('SUPPLY', 'CHEMICAL')
      AND NOT EXISTS (SELECT 1 FROM equipment_stock s WHERE s.catalog_id = c.id AND s.quantity > 0);
END
$$;
--rollback SELECT 1;
