--liquibase formatted sql

-- Danh mục thiết bị chỉ còn ĐÚNG các thiết bị của Danh mục thiết bị dạy học tối thiểu (096).
--
-- 35 thiết bị demo cũ (TB-MAYCHIEU, TB-LAPTOP, HC-HCL…) và một thiết bị thử của trường được map
-- sang thiết bị phụ lục TƯƠNG ỨNG THEO CẤP HỌC của trường đang dùng nó — máy chiếu ở trường THCS
-- thành THCS-DC-013, ở trường THPT thành THPT-DC-013 — trên mọi chỗ trỏ tới: tài sản, dòng phiếu
-- nhập, dòng đề xuất, xuất kho, ghi tiêu hao, tồn kho, tài sản thừa kiểm kê. Thiết bị demo nào
-- KHÔNG có thiết bị tương ứng ở cấp đó (bàn ghế học sinh, máy tính bảng, tai nghe, robot THCS, tủ
-- hút THCS, quả địa cầu THPT…) thì xoá luôn cùng tài sản demo và các dòng phiếu dính tới — theo
-- quyết định của trưởng nhóm: danh mục không giữ thiết bị ngoài thông tư; trường có đồ ngoài thông
-- tư thì thêm lại qua "thiết bị ngoài danh mục" lúc ghi tăng (087).
--
-- Mã đồng bộ: tài sản được map mà MÔN đổi (kính hiển vi THCS: Sinh học → KHTN) thì thành phần MH
-- của mã TT.TR.MH.LT.ST.NC đổi theo — cấp lại số thứ tự nối tiếp bộ đếm của bộ mã mới, ghi lịch
-- sử như 082.
--
-- Mã đích là mã do backend/tools/tbdh_toi_thieu.py sinh ở 096. Changeset đầu kiểm cho đủ: thiếu
-- mã nào (bộ sinh đổi thứ tự) thì DỪNG, không để dòng đó rơi vào nhánh "xoá".

--changeset qltb:097-remap-demo-catalogs splitStatements:false
CREATE TEMP TABLE catalog_map (old_code VARCHAR(64), level VARCHAR(10), new_code VARCHAR(64)) ON COMMIT DROP;
INSERT INTO catalog_map VALUES
    ('HC-HCL', 'THCS', 'THCS-KHTN-072'), ('HC-HCL', 'THPT', 'THPT-HH-087'),
    ('HC-NAOH', 'THCS', 'THCS-KHTN-070'), ('HC-NAOH', 'THPT', 'THPT-HH-086'),
    ('PM-MOPHONGVL', 'THCS', 'THCS-KHTN-057'), ('PM-MOPHONGVL', 'THPT', 'THPT-VL-054'),
    ('TB-BANDOTG', 'TH', 'TH-LSDL-003'),
    ('TB-BANDOVN', 'TH', 'TH-LSDL-002'), ('TB-BANDOVN', 'THCS', 'THCS-DL-038'), ('TB-BANDOVN', 'THPT', 'THPT-DL-024'),
    ('TB-BANGTT', 'TH', 'TH-DC-013'), ('TB-BANGTT', 'THCS', 'THCS-DC-013'), ('TB-BANGTT', 'THPT', 'THPT-DC-013'),
    ('TB-BOCOHOC', 'THCS', 'THCS-KHTN-018'), ('TB-BOCOHOC', 'THPT', 'THPT-VL-020'),
    ('TB-BODIEN', 'TH', 'TH-KH-012'), ('TB-BODIEN', 'THCS', 'THCS-KHTN-173'), ('TB-BODIEN', 'THPT', 'THPT-VL-040'),
    ('TB-BOHINHHOC', 'TH', 'TH-TOAN-004'), ('TB-BOHINHHOC', 'THCS', 'THCS-TOAN-001'), ('TB-BOHINHHOC', 'THPT', 'THPT-TOAN-001'),
    ('TB-BONGDA', 'TH', 'TH-GDTC-018'), ('TB-BONGDA', 'THCS', 'THCS-GDTC-024'), ('TB-BONGDA', 'THPT', 'THPT-GDTC-024'),
    ('TB-BOQUANGHOC', 'THCS', 'THCS-KHTN-010'),
    ('TB-CANDIENTU', 'THCS', 'THCS-KHTN-052'), ('TB-CANDIENTU', 'THPT', 'THPT-HH-002'),
    ('TB-DANORGAN', 'TH', 'TH-AN-013'), ('TB-DANORGAN', 'THCS', 'THCS-AN-013'), ('TB-DANORGAN', 'THPT', 'THPT-AN-021'),
    ('TB-GIAVE', 'TH', 'TH-MT-002'), ('TB-GIAVE', 'THCS', 'THCS-MT-009'), ('TB-GIAVE', 'THPT', 'THPT-MT-009'),
    ('TB-KINHHV', 'THCS', 'THCS-KHTN-055'), ('TB-KINHHV', 'THPT', 'THPT-SH-006'),
    ('TB-KINHLUP', 'TH', 'TH-KH-016'), ('TB-KINHLUP', 'THCS', 'THCS-KHTN-004'), ('TB-KINHLUP', 'THPT', 'THPT-CN-035'),
    ('TB-LAPTOP', 'TH', 'TH-TIN-002'), ('TB-LAPTOP', 'THCS', 'THCS-TIN-002'), ('TB-LAPTOP', 'THPT', 'THPT-TIN-002'),
    ('TB-MAYTINH', 'TH', 'TH-TIN-002'), ('TB-MAYTINH', 'THCS', 'THCS-TIN-002'), ('TB-MAYTINH', 'THPT', 'THPT-TIN-002'),
    ('TB-LOA', 'TH', 'TH-DC-010'), ('TB-LOA', 'THCS', 'THCS-DC-010'), ('TB-LOA', 'THPT', 'THPT-DC-010'),
    ('TB-MAYANH', 'TH', 'TH-DC-017'), ('TB-MAYANH', 'THCS', 'THCS-DC-017'), ('TB-MAYANH', 'THPT', 'THPT-DC-017'),
    ('TB-MAYCHIEU', 'TH', 'TH-DC-013'), ('TB-MAYCHIEU', 'THCS', 'THCS-DC-013'), ('TB-MAYCHIEU', 'THPT', 'THPT-DC-013'),
    ('TB-TIVI', 'TH', 'TH-DC-013'), ('TB-TIVI', 'THCS', 'THCS-DC-013'), ('TB-TIVI', 'THPT', 'THPT-DC-013'),
    ('TB-MAYCHIEUVAT', 'TH', 'TH-DC-015'), ('TB-MAYCHIEUVAT', 'THCS', 'THCS-DC-015'), ('TB-MAYCHIEUVAT', 'THPT', 'THPT-DC-015'),
    ('TB-MAYIN', 'TH', 'TH-DC-016'), ('TB-MAYIN', 'THCS', 'THCS-DC-016'), ('TB-MAYIN', 'THPT', 'THPT-DC-016'),
    ('TB-MOHINHADN', 'THCS', 'THCS-KHTN-240'), ('TB-MOHINHADN', 'THPT', 'THPT-SH-058'),
    ('TB-MOHINHCT', 'TH', 'TH-TNXH-022'), ('TB-MOHINHCT', 'THCS', 'THCS-KHTN-237'),
    ('TB-ONGNGHIEM', 'THCS', 'THCS-KHTN-041'), ('TB-ONGNGHIEM', 'THPT', 'THPT-HH-023'),
    ('TB-QUADIACAU', 'TH', 'TH-TNXH-023'), ('TB-QUADIACAU', 'THCS', 'THCS-DL-002'),
    ('TB-ROBOT', 'THPT', 'THPT-TIN-034'),
    ('TB-TUHOTKHI', 'THPT', 'THPT-HH-003'),
    ('TB-WIFI', 'TH', 'TH-TIN-003'), ('TB-WIFI', 'THCS', 'THCS-TIN-003'), ('TB-WIFI', 'THPT', 'THPT-TIN-004');

-- Mã đích phải có đủ — thiếu là bộ sinh 096 đã đổi thứ tự, dừng tại đây.
DO $$
DECLARE missing TEXT;
BEGIN
    SELECT string_agg(DISTINCT m.new_code, ', ') INTO missing FROM catalog_map m
    WHERE NOT EXISTS (SELECT 1 FROM equipment_catalogs c WHERE c.code = m.new_code);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION '097: thiếu thiết bị đích % — kiểm lại bảng map với dữ liệu 096', missing;
    END IF;
END $$;

-- Thiết bị cần dọn: mọi thiết bị không có dòng nào của danh mục tối thiểu trỏ tới (cờ
-- minimum_required không dùng được — thiết bị demo cũ cũng mang cờ đó).
CREATE TEMP TABLE junk ON COMMIT DROP AS
SELECT c.id, c.code FROM equipment_catalogs c
WHERE NOT EXISTS (SELECT 1 FROM equipment_norms n WHERE n.catalog_id = c.id);
CREATE TEMP TABLE junk_target ON COMMIT DROP AS
SELECT j.id AS old_id, l.code AS level, n.id AS new_id
FROM junk j JOIN catalog_map m ON m.old_code = j.code
JOIN education_levels l ON l.code = m.level
JOIN equipment_catalogs n ON n.code = m.new_code;

-- Cấp học của trường, cho mọi bảng có trường.
CREATE TEMP TABLE school_level ON COMMIT DROP AS
SELECT s.id AS school_id, l.code AS level FROM schools s JOIN education_levels l ON l.id = s.education_level_id;

-- ---------------------------------------------------------------- map
CREATE TEMP TABLE remapped ON COMMIT DROP AS
SELECT e.id, t.new_id FROM equipment e
JOIN junk_target t ON t.old_id = e.catalog_id
JOIN school_level sl ON sl.school_id = e.school_id AND sl.level = t.level;
UPDATE equipment e SET catalog_id = r.new_id, updated_at = now() FROM remapped r WHERE e.id = r.id;

UPDATE equipment_intake_lines x SET catalog_id = t.new_id
FROM equipment_intakes i, school_level sl, junk_target t
WHERE i.id = x.intake_id AND sl.school_id = i.school_id AND t.old_id = x.catalog_id AND t.level = sl.level;

UPDATE purchase_proposal_lines x SET catalog_id = t.new_id
FROM purchase_proposals p, school_level sl, junk_target t
WHERE p.id = x.proposal_id AND sl.school_id = p.school_id AND t.old_id = x.catalog_id AND t.level = sl.level;

UPDATE stock_issue_lines x SET catalog_id = t.new_id
FROM stock_issues i, school_level sl, junk_target t
WHERE i.id = x.issue_id AND sl.school_id = i.school_id AND t.old_id = x.catalog_id AND t.level = sl.level;

UPDATE consumption_records x SET catalog_id = t.new_id
FROM school_level sl, junk_target t
WHERE sl.school_id = x.school_id AND t.old_id = x.catalog_id AND t.level = sl.level;

UPDATE inventory_surplus x SET catalog_id = t.new_id
FROM inventory_sessions s, school_level sl, junk_target t
WHERE s.id = x.session_id AND sl.school_id = s.school_id AND t.old_id = x.catalog_id AND t.level = sl.level;

UPDATE equipment_stock x SET catalog_id = t.new_id
FROM school_level sl, junk_target t
WHERE sl.school_id = x.school_id AND t.old_id = x.catalog_id AND t.level = sl.level;

-- Đơn vị theo thiết bị trong danh mục: tài sản từng cái lấy đúng đơn vị của phụ lục (máy chiếu
-- "Chiếc" → "Bộ"). Lô hoá chất ghi theo kg đổi sang gam (×1000) cho khớp phụ lục; lô ghi theo
-- "bình" không quy được ra ml (không biết dung tích bình) nên giữ nguyên.
UPDATE equipment e SET unit_id = c.unit_id, updated_at = now()
FROM remapped r, equipment_catalogs c
WHERE e.id = r.id AND c.id = e.catalog_id AND c.unit_id IS NOT NULL
  AND COALESCE(e.quantity, 1) = 1 AND e.unit_id IS DISTINCT FROM c.unit_id;
UPDATE equipment e SET quantity = e.quantity * 1000, unit_id = c.unit_id, updated_at = now()
FROM remapped r, equipment_catalogs c, units ue, units uc
WHERE e.id = r.id AND c.id = e.catalog_id AND ue.id = e.unit_id AND uc.id = c.unit_id
  AND ((ue.code = 'KG' AND uc.code = 'G') OR (ue.code = 'LIT' AND uc.code = 'ML'));

-- Thiết bị phụ lục nhận LÔ (một bản ghi nhiều cái — ống nghiệm, quả bóng của dữ liệu cũ) thì
-- quản lý theo lô, loại vật tư, cho khớp dữ liệu đang có.
UPDATE equipment_catalogs c SET tracking_type = 'BULK', asset_category = COALESCE(c.asset_category, 'SUPPLY'),
       updated_at = now()
WHERE c.tracking_type = 'SERIAL'
  AND EXISTS (SELECT 1 FROM equipment e JOIN remapped r ON r.id = e.id
              WHERE e.catalog_id = c.id AND COALESCE(e.quantity, 1) <> 1);

-- ---------------------------------------------------------------- mã tài sản theo môn mới
CREATE TEMP TABLE recode ON COMMIT DROP AS
SELECT e.id, e.school_id, e.code AS old_code,
       split_part(e.code, '.', 1) || '.' || split_part(e.code, '.', 2) || '.'
           || COALESCE(NULLIF(sj.teaching_code, ''), '00') || '.' || split_part(e.code, '.', 4) AS head,
       split_part(e.code, '.', 6) AS year
FROM equipment e
JOIN remapped r ON r.id = e.id
JOIN equipment_catalogs c ON c.id = e.catalog_id
LEFT JOIN subjects sj ON sj.id = c.subject_id
WHERE e.code ~ '^[0-9]{2}\.[A-Z0-9]{2}\.[0-9]{2}\.(TB|PM|HL)\.[0-9]{3}\.[0-9]{2}$'
  AND split_part(e.code, '.', 3) <> COALESCE(NULLIF(sj.teaching_code, ''), '00');

-- Số thứ tự nối tiếp: lớn nhất của bộ đếm và của mã đang có trong bộ mã mới.
CREATE TEMP TABLE recode_st ON COMMIT DROP AS
SELECT r.*, base.n + row_number() OVER (PARTITION BY r.school_id, r.head, r.year ORDER BY r.id) AS st
FROM recode r
CROSS JOIN LATERAL (
    SELECT GREATEST(
        COALESCE((SELECT q.current_number FROM equipment_code_sequences q
                  WHERE q.school_id = r.school_id AND q.code_prefix = r.head || '.' || r.year), 0),
        COALESCE((SELECT max(split_part(e2.code, '.', 5)::int) FROM equipment e2
                  WHERE e2.school_id = r.school_id AND e2.code LIKE r.head || '.___.' || r.year), 0)) AS n
) base;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM recode_st WHERE st > 999) THEN
        RAISE EXCEPTION '097: bộ mã mới vượt 999 tài sản';
    END IF;
END $$;

UPDATE equipment e SET code = r.head || '.' || lpad(r.st::text, 3, '0') || '.' || r.year, updated_at = now()
FROM recode_st r WHERE e.id = r.id;

INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, note, created_at)
SELECT r.id, 'CAP_NHAT', 'code', r.old_code, r.head || '.' || lpad(r.st::text, 3, '0') || '.' || r.year,
       'Thiết bị chuyển sang Danh mục thiết bị dạy học tối thiểu — mã môn đổi theo', now()
FROM recode_st r;

INSERT INTO equipment_code_sequences (school_id, code_prefix, current_number)
SELECT school_id, head || '.' || year, max(st) FROM recode_st GROUP BY school_id, head, year
ON CONFLICT (school_id, code_prefix)
DO UPDATE SET current_number = GREATEST(equipment_code_sequences.current_number, EXCLUDED.current_number);

-- Tài sản còn mang mã không theo chuẩn (mã tạm LEG… của dữ liệu thử): cấp mã chuẩn, mã cũ giữ ở
-- legacy_code để tem cũ vẫn tra được — như POST /equipment/{id}/standard-code. Chỉ khi đủ dữ liệu
-- dựng mã (trường có mã hai ký tự, môn có mã dạy học hai số).
CREATE TEMP TABLE legacy ON COMMIT DROP AS
SELECT e.id, e.school_id, e.code AS old_code,
       '79.' || upper(s.short_code) || '.' || COALESCE(NULLIF(sj.teaching_code, ''), '00') || '.'
           || CASE e.physical_or_digital WHEN 'DIGITAL' THEN 'PM' WHEN 'LEARNING_SUPPORT' THEN 'HL' ELSE 'TB' END AS head,
       lpad((extract(year FROM COALESCE(e.received_date, e.purchase_date, current_date))::int % 100)::text, 2, '0') AS year
FROM equipment e
JOIN schools s ON s.id = e.school_id
JOIN equipment_catalogs c ON c.id = e.catalog_id
LEFT JOIN subjects sj ON sj.id = c.subject_id
WHERE e.catalog_id NOT IN (SELECT id FROM junk)
  AND e.code !~ '^[0-9]{2}\.[A-Z0-9]{2}\.[0-9]{2}\.(TB|PM|HL)\.[0-9]{3}\.[0-9]{2}$'
  AND upper(s.short_code) ~ '^[A-Z0-9]{2}$'
  AND COALESCE(NULLIF(sj.teaching_code, ''), '00') ~ '^[0-9]{2}$';

CREATE TEMP TABLE legacy_st ON COMMIT DROP AS
SELECT r.*, base.n + row_number() OVER (PARTITION BY r.school_id, r.head, r.year ORDER BY r.id) AS st
FROM legacy r
CROSS JOIN LATERAL (
    SELECT GREATEST(
        COALESCE((SELECT q.current_number FROM equipment_code_sequences q
                  WHERE q.school_id = r.school_id AND q.code_prefix = r.head || '.' || r.year), 0),
        COALESCE((SELECT max(split_part(e2.code, '.', 5)::int) FROM equipment e2
                  WHERE e2.school_id = r.school_id AND e2.code LIKE r.head || '.___.' || r.year), 0)) AS n
) base;

UPDATE equipment e SET legacy_code = COALESCE(e.legacy_code, r.old_code),
       code = r.head || '.' || lpad(r.st::text, 3, '0') || '.' || r.year, updated_at = now()
FROM legacy_st r WHERE e.id = r.id AND r.st <= 999;

INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, note, created_at)
SELECT r.id, 'CAP_NHAT', 'code', r.old_code, r.head || '.' || lpad(r.st::text, 3, '0') || '.' || r.year,
       'Cấp mã chuẩn — mã cũ giữ làm mã cũ (legacy)', now()
FROM legacy_st r WHERE r.st <= 999;

INSERT INTO equipment_code_sequences (school_id, code_prefix, current_number)
SELECT school_id, head || '.' || year, max(st) FROM legacy_st WHERE st <= 999 GROUP BY school_id, head, year
ON CONFLICT (school_id, code_prefix)
DO UPDATE SET current_number = GREATEST(equipment_code_sequences.current_number, EXCLUDED.current_number);

-- ---------------------------------------------------------------- xoá phần không có thiết bị tương ứng
CREATE TEMP TABLE junk_equipment ON COMMIT DROP AS
SELECT e.id FROM equipment e WHERE e.catalog_id IN (SELECT id FROM junk);

DELETE FROM equipment_allocation_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM equipment_transfer_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM equipment_loan_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM damage_report_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM inventory_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM disposal_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM repair_order_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM warranty_claim_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM maintenance_order_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM storage_order_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM depreciation_order_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM room_booking_lines WHERE equipment_id IN (SELECT id FROM junk_equipment);
DELETE FROM attachments WHERE resource = 'equipment' AND record_id IN (SELECT id FROM junk_equipment);
DELETE FROM equipment WHERE id IN (SELECT id FROM junk_equipment);

DELETE FROM attachments WHERE resource = 'equipment_intake_lines'
    AND record_id IN (SELECT id FROM equipment_intake_lines WHERE catalog_id IN (SELECT id FROM junk));
DELETE FROM equipment_intake_lines WHERE catalog_id IN (SELECT id FROM junk);
DELETE FROM purchase_proposal_lines WHERE catalog_id IN (SELECT id FROM junk);
DELETE FROM stock_issue_lines WHERE catalog_id IN (SELECT id FROM junk);
DELETE FROM consumption_records WHERE catalog_id IN (SELECT id FROM junk);
DELETE FROM inventory_surplus WHERE catalog_id IN (SELECT id FROM junk);
DELETE FROM equipment_stock WHERE catalog_id IN (SELECT id FROM junk);

UPDATE equipment_catalogs SET parent_id = NULL WHERE parent_id IN (SELECT id FROM junk);
DELETE FROM equipment_catalogs WHERE id IN (SELECT id FROM junk);
--rollback SELECT 1;
