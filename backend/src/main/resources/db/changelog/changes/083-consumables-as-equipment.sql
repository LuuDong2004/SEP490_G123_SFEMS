--liquibase formatted sql

-- VẬT TƯ TIÊU HAO là THIẾT BỊ: một bản ghi `equipment` mang cả số lượng (12 bình HCl = một
-- bản ghi, quantity 12), có mã chuẩn TT.TR.MH.LT.ST.NC, tên, hồ sơ, phiếu nhập, lịch sử như mọi
-- thiết bị. "Theo số lượng" chỉ là cách quản lý. Từ đây phiếu nhập sinh bản ghi đó
-- (EquipmentService.generateLotFromIntakeLine), xuất kho / ghi tiêu hao trừ vào nó
-- (EquipmentService.consumeLot); equipment_stock không còn được dùng.

--changeset qltb:083-equipment-quantity-may-reach-zero
--comment Lô vật tư dùng hết còn giữ hồ sơ với số lượng 0 (trạng thái USED_UP).
ALTER TABLE equipment DROP CONSTRAINT ck_equipment_quantity;
ALTER TABLE equipment ADD CONSTRAINT ck_equipment_quantity CHECK (quantity >= 0);
--rollback ALTER TABLE equipment DROP CONSTRAINT ck_equipment_quantity; ALTER TABLE equipment ADD CONSTRAINT ck_equipment_quantity CHECK (quantity >= 1);

--changeset qltb:083-stock-rows-to-equipment splitStatements:false
--comment Mỗi dòng equipment_stock còn số lượng thành một bản ghi thiết bị có mã chuẩn, số lượng, phiếu nhập gần nhất và lịch sử; rồi làm trống equipment_stock.
DO $$
DECLARE
    st RECORD;
    v_num INT;
    v_key TEXT;
    v_code TEXT;
    v_date DATE;
    v_mh TEXT;
    v_lt TEXT;
    v_eq BIGINT;
BEGIN
    FOR st IN
        SELECT s.id, s.school_id, s.catalog_id, s.room_id, s.quantity, s.created_at,
               upper(trim(sc.short_code)) AS tr, c.name AS catalog_name, c.unit_id, c.physical_or_digital,
               c.asset_category, sj.teaching_code,
               (s.room_id IS NULL OR rt.code = 'KHO') AS in_store,
               li.line_id, li.line_name, li.unit_price, li.intake_id, li.intake_code, li.funding_source,
               li.origin_source_id, li.acquisition_method_id, li.document_date, li.actor_id, li.actor_name,
               fi.first_date
        FROM equipment_stock s
        JOIN schools sc ON sc.id = s.school_id
        JOIN equipment_catalogs c ON c.id = s.catalog_id
        LEFT JOIN subjects sj ON sj.id = c.subject_id
        LEFT JOIN rooms r ON r.id = s.room_id
        LEFT JOIN room_types rt ON rt.id = r.room_type_id
        LEFT JOIN LATERAL (
            SELECT l.id AS line_id, l.name AS line_name, l.unit_price, i.id AS intake_id, i.code AS intake_code,
                   i.funding_source, i.origin_source_id, i.acquisition_method_id, i.document_date,
                   i.confirmed_by_id AS actor_id, u.full_name AS actor_name
            FROM equipment_intake_lines l
            JOIN equipment_intakes i ON i.id = l.intake_id
            LEFT JOIN users u ON u.id = i.confirmed_by_id
            WHERE i.status = 'COMPLETED' AND i.school_id = s.school_id AND l.catalog_id = s.catalog_id
              AND l.room_id IS NOT DISTINCT FROM s.room_id
            ORDER BY i.intake_date DESC, i.id DESC
            LIMIT 1
        ) li ON TRUE
        LEFT JOIN LATERAL (
            SELECT min(i.intake_date) AS first_date
            FROM equipment_intake_lines l
            JOIN equipment_intakes i ON i.id = l.intake_id
            WHERE i.status = 'COMPLETED' AND i.school_id = s.school_id AND l.catalog_id = s.catalog_id
              AND l.room_id IS NOT DISTINCT FROM s.room_id
        ) fi ON TRUE
        WHERE s.quantity > 0
        ORDER BY s.id
    LOOP
        IF st.tr IS NULL OR st.tr !~ '^[A-Z0-9]{2}$' THEN
            RAISE NOTICE '083: trường % chưa có mã TR — dòng tồn kho % giữ nguyên', st.school_id, st.id;
            CONTINUE;
        END IF;
        v_date := coalesce(st.first_date, st.created_at::date);
        v_mh := coalesce(nullif(trim(st.teaching_code), ''), '00');
        v_lt := CASE WHEN st.physical_or_digital = 'DIGITAL' THEN 'PM' ELSE 'TB' END;
        v_key := '79.' || st.tr || '.' || v_mh || '.' || v_lt || '.' || to_char(v_date, 'YY');
        INSERT INTO equipment_code_sequences (school_id, code_prefix, current_number) VALUES (st.school_id, v_key, 1)
        ON CONFLICT (school_id, code_prefix) DO UPDATE SET current_number = equipment_code_sequences.current_number + 1
        RETURNING current_number INTO v_num;
        IF v_num > 999 THEN
            UPDATE equipment_code_sequences SET current_number = 999 WHERE school_id = st.school_id AND code_prefix = v_key;
            RAISE NOTICE '083: bộ mã % hết số — dòng tồn kho % giữ nguyên', v_key, st.id;
            CONTINUE;
        END IF;
        v_code := '79.' || st.tr || '.' || v_mh || '.' || v_lt || '.' || lpad(v_num::text, 3, '0') || '.' || to_char(v_date, 'YY');

        INSERT INTO equipment (school_id, code, name, active, catalog_id, physical_or_digital, asset_category, unit_id,
                               quantity, origin_source_id, acquisition_method_id, funding_source, usage_start_year,
                               received_date, purchase_date, original_value, remaining_value, room_id, condition,
                               status, specs, intake_line_id, created_at, created_by_id)
        VALUES (st.school_id, v_code, coalesce(st.line_name, st.catalog_name), TRUE, st.catalog_id,
                coalesce(st.physical_or_digital, 'PHYSICAL'), st.asset_category, st.unit_id, st.quantity,
                st.origin_source_id, st.acquisition_method_id, st.funding_source, extract(YEAR FROM v_date)::int,
                v_date, st.document_date, st.unit_price * st.quantity, st.unit_price * st.quantity, st.room_id, 'TOT',
                CASE WHEN st.in_store THEN 'IN_STOCK' ELSE 'IN_USE' END, '{}'::jsonb, st.line_id,
                now(), st.actor_id)
        RETURNING id INTO v_eq;

        INSERT INTO equipment_history (equipment_id, action, voucher_resource, voucher_id, voucher_code, note,
                                       actor_id, actor_name, created_at)
        VALUES (v_eq, 'GHI_TANG', CASE WHEN st.intake_id IS NULL THEN NULL ELSE 'equipment_intakes' END,
                st.intake_id, st.intake_code,
                'Vật tư tiêu hao chuyển sang hồ sơ thiết bị: ' || st.quantity || ' — số lượng hiện có khi chuyển',
                st.actor_id, st.actor_name, now());

        DELETE FROM equipment_stock WHERE id = st.id;
    END LOOP;
    DELETE FROM equipment_stock WHERE quantity <= 0;
END
$$;
--rollback SELECT 1;
