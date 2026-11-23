--liquibase formatted sql

-- Loại thiết bị theo NHÓM CỦA PHỤ LỤC thông tư 37/38/39 (VBHN 02, 03, 06/VBHN-BGDĐT), thay mười loại
-- tự đặt ở 019 (Thiết bị dạy học, Thiết bị thí nghiệm, Máy móc thiết bị, Thiết bị CNTT…).
--
-- Bộ không ban hành danh mục "loại thiết bị" có mã; thứ thông tư có là TIÊU ĐỀ NHÓM trong phụ lục
-- từng môn — "Thiết bị dùng chung", "Tranh ảnh", "Bản đồ/lược đồ", "Mô hình, mẫu vật", "Dụng cụ",
-- "Hóa chất", "Video/clip", "Phần mềm", "Nhạc cụ" — đã lưu ở equipment_norms.section_name (096).
-- Loại mới lấy theo đúng các nhóm đó:
--
--   THIET_BI_DUNG_CHUNG    Thiết bị dùng chung          nhóm "Thiết bị dùng chung"; máy tính, máy chiếu, màn hình…
--   TRANH_ANH              Tranh ảnh                    nhóm "Tranh ảnh", "Tranh/ảnh"; tên bắt đầu bằng tranh, sơ đồ, biểu đồ
--   BAN_DO_LUOC_DO         Bản đồ, lược đồ              nhóm "Bản đồ/lược đồ"; tên bắt đầu bằng bản đồ, lược đồ
--   MO_HINH_MAU_VAT        Mô hình, mẫu vật             nhóm "Mô hình", "Mô hình, mẫu vật"; sa bàn, tiêu bản
--   DUNG_CU                Dụng cụ                      nhóm "Dụng cụ", và mọi dòng "Thiết bị theo (các) chủ đề"
--                                                       không nói rõ hơn — phụ lục xếp dụng cụ, bộ thí nghiệm ở đó
--   HOA_CHAT               Hoá chất                     giữ đúng các thiết bị 096 đã xếp là hoá chất (đơn vị g, ml…)
--   HOC_LIEU_SO            Video, phần mềm, học liệu số nhóm "Video/clip", "Phần mềm", "Băng, đĩa", học liệu số
--   NHAC_CU                Nhạc cụ                      nhóm "Nhạc cụ thể hiện tiết tấu / giai điệu, hoà âm"
--   THIET_BI_PHONG_BO_MON  Thiết bị phòng học bộ môn    hệ thống thiết bị ngoại ngữ, phòng thực hành tin học
--   KHAC                   Khác                         không dùng cho thiết bị phụ lục
--
-- Một thiết bị có thể ghi ở nhiều dòng phụ lục: loại của nó là loại của dòng đầu tiên (thứ tự phụ
-- lục), và mọi dòng định mức của nó mang CÙNG loại đó — một thiết bị không đứng ở hai loại.
-- Thiết bị không có dòng phụ lục (thiết bị ngoài danh mục của trường, 087) đổi theo loại cũ.
--
-- Cuối cùng kiểm: còn chỗ nào trỏ tới loại cũ thì DỪNG.

--changeset qltb:098-equipment-types-by-appendix splitStatements:false
CREATE FUNCTION pg_temp.fold(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT translate(lower(coalesce(t, '')),
        'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
        'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
$$;

-- Loại của từng dòng phụ lục, tính TRƯỚC khi đổi tên loại cũ (luật đầu đọc loại cũ HOA_CHAT).
CREATE TEMP TABLE norm_type ON COMMIT DROP AS
SELECT n.id AS norm_id, n.catalog_id, n.sort_order,
       CASE
           WHEN ot.code = 'HOA_CHAT' THEN 'HOA_CHAT'
           WHEN pg_temp.fold(n.section_name) ~ 'nhac cu' THEN 'NHAC_CU'
           WHEN pg_temp.fold(regexp_replace(n.section_name, '^.*› ', '')) ~ '(video|clip|phim|phan mem|hoc lieu so|hoc lieu dien tu)'
                OR c.physical_or_digital = 'DIGITAL' THEN 'HOC_LIEU_SO'
           WHEN pg_temp.fold(regexp_replace(n.section_name, '^.*› ', '')) ~ '(ban do|luoc do)'
                OR pg_temp.fold(coalesce(c.name, n.name)) ~ '^(bo )?(ban do|luoc do)' THEN 'BAN_DO_LUOC_DO'
           WHEN pg_temp.fold(regexp_replace(n.section_name, '^.*› ', '')) ~ 'tranh'
                OR pg_temp.fold(coalesce(c.name, n.name)) ~ '^(bo )?(tranh|anh |so do|bang so lieu|bieu do)' THEN 'TRANH_ANH'
           WHEN pg_temp.fold(regexp_replace(n.section_name, '^.*› ', '')) ~ '(mo hinh|mau vat)'
                OR pg_temp.fold(coalesce(c.name, n.name)) ~ '^(bo )?(mo hinh|mau vat|sa ban|tieu ban)' THEN 'MO_HINH_MAU_VAT'
           WHEN pg_temp.fold(n.section_name) ~ 'dung chung' THEN 'THIET_BI_DUNG_CHUNG'
           WHEN pg_temp.fold(n.section_name) ~ '(ngoai ngu|phong thuc hanh tin hoc)' THEN 'THIET_BI_PHONG_BO_MON'
           WHEN pg_temp.fold(coalesce(c.name, n.name)) ~ '^(may tinh|bo may vi tinh|may chieu|man hinh|ti ?vi|loa|may in|bang tuong tac|thiet bi trinh chieu)' THEN 'THIET_BI_DUNG_CHUNG'
           ELSE 'DUNG_CU'
       END AS type_code
FROM equipment_norms n
LEFT JOIN equipment_catalogs c ON c.id = n.catalog_id
LEFT JOIN equipment_types ot ON ot.id = c.equipment_type_id;

-- Loại của thiết bị = loại của dòng phụ lục đầu tiên của nó.
CREATE TEMP TABLE catalog_type ON COMMIT DROP AS
SELECT DISTINCT ON (catalog_id) catalog_id, type_code
FROM norm_type WHERE catalog_id IS NOT NULL
ORDER BY catalog_id, sort_order, norm_id;

-- Loại cũ → loại mới, cho thiết bị không có dòng phụ lục và cho cấu hình thiết bị.
CREATE TEMP TABLE old_type_map (old_code VARCHAR(64), new_code VARCHAR(64)) ON COMMIT DROP;
INSERT INTO old_type_map VALUES
    ('THIET_BI_DAY_HOC', 'DUNG_CU'),
    ('THIET_BI_THI_NGHIEM', 'DUNG_CU'),
    ('DO_DUNG_DAY_HOC', 'DUNG_CU'),
    ('MAY_MOC_THIET_BI', 'THIET_BI_DUNG_CHUNG'),
    ('THIET_BI_CNTT', 'THIET_BI_DUNG_CHUNG'),
    ('TRANH_ANH_BAN_DO', 'TRANH_ANH');

-- Đổi tên các loại giữ lại, thêm loại mới.
UPDATE equipment_types SET code = 'TRANH_ANH', name = 'Tranh ảnh', sort_order = 2, updated_at = now()
WHERE code = 'TRANH_ANH_BAN_DO';
UPDATE equipment_types SET name = 'Mô hình, mẫu vật', sort_order = 4, updated_at = now() WHERE code = 'MO_HINH_MAU_VAT';
UPDATE equipment_types SET name = 'Dụng cụ', sort_order = 5, updated_at = now() WHERE code = 'DUNG_CU';
UPDATE equipment_types SET name = 'Hoá chất', sort_order = 6, updated_at = now() WHERE code = 'HOA_CHAT';
UPDATE equipment_types SET name = 'Khác', sort_order = 10, updated_at = now() WHERE code = 'KHAC';
UPDATE old_type_map SET old_code = 'TRANH_ANH' WHERE old_code = 'TRANH_ANH_BAN_DO';
DELETE FROM old_type_map WHERE old_code = new_code;

INSERT INTO equipment_types (code, name, sort_order, active, created_at)
SELECT v.code, v.name, v.sort_order, TRUE, now()
FROM (VALUES
    ('THIET_BI_DUNG_CHUNG', 'Thiết bị dùng chung', 1),
    ('BAN_DO_LUOC_DO', 'Bản đồ, lược đồ', 3),
    ('HOC_LIEU_SO', 'Video, phần mềm, học liệu số', 7),
    ('NHAC_CU', 'Nhạc cụ', 8),
    ('THIET_BI_PHONG_BO_MON', 'Thiết bị phòng học bộ môn', 9)) AS v (code, name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM equipment_types t WHERE t.code = v.code);

-- Thiết bị phụ lục: theo dòng đầu tiên. Dòng định mức: cùng loại với thiết bị của nó.
UPDATE equipment_catalogs c SET equipment_type_id = t.id, updated_at = now()
FROM catalog_type ct JOIN equipment_types t ON t.code = ct.type_code
WHERE c.id = ct.catalog_id AND c.equipment_type_id IS DISTINCT FROM t.id;

UPDATE equipment_norms n SET equipment_type_id = c.equipment_type_id, updated_at = now()
FROM equipment_catalogs c
WHERE c.id = n.catalog_id AND n.equipment_type_id IS DISTINCT FROM c.equipment_type_id;

UPDATE equipment_norms n SET equipment_type_id = t.id, updated_at = now()
FROM norm_type nt JOIN equipment_types t ON t.code = nt.type_code
WHERE n.id = nt.norm_id AND n.catalog_id IS NULL;

-- Còn lại (thiết bị ngoài danh mục, dòng không gắn thiết bị): theo loại cũ.
UPDATE equipment_catalogs c SET equipment_type_id = nt.id, updated_at = now()
FROM equipment_types ot JOIN old_type_map m ON m.old_code = ot.code JOIN equipment_types nt ON nt.code = m.new_code
WHERE c.equipment_type_id = ot.id;

UPDATE equipment_norms n SET equipment_type_id = nt.id, updated_at = now()
FROM equipment_types ot JOIN old_type_map m ON m.old_code = ot.code JOIN equipment_types nt ON nt.code = m.new_code
WHERE n.equipment_type_id = ot.id;

INSERT INTO equipment_config_scope_types (config_id, equipment_type_id)
SELECT DISTINCT s.config_id, nt.id
FROM equipment_config_scope_types s
JOIN equipment_types ot ON ot.id = s.equipment_type_id
JOIN old_type_map m ON m.old_code = ot.code
JOIN equipment_types nt ON nt.code = m.new_code
WHERE NOT EXISTS (SELECT 1 FROM equipment_config_scope_types x WHERE x.config_id = s.config_id AND x.equipment_type_id = nt.id);

DELETE FROM equipment_config_scope_types s
USING equipment_types ot, old_type_map m
WHERE ot.id = s.equipment_type_id AND m.old_code = ot.code;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM equipment_catalogs c JOIN equipment_types t ON t.id = c.equipment_type_id
               JOIN old_type_map m ON m.old_code = t.code)
       OR EXISTS (SELECT 1 FROM equipment_norms n JOIN equipment_types t ON t.id = n.equipment_type_id
               JOIN old_type_map m ON m.old_code = t.code) THEN
        RAISE EXCEPTION '098: vẫn còn thiết bị / định mức trỏ tới loại cũ';
    END IF;
END $$;

DELETE FROM equipment_types t USING old_type_map m WHERE m.old_code = t.code;
