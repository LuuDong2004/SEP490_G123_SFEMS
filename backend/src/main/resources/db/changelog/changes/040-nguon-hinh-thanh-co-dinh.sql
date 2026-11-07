--liquibase formatted sql

--changeset tutn:040-nguon-hinh-thanh-co-dinh
--comment Nguồn hình thành thành danh mục cố định sáu dòng (DM-01); phương thức hình thành chỉ còn là hình thức mua sắm.

-- Trước đây hai danh mục lẫn nghĩa: "nguồn hình thành" lại chứa nguồn tiền (ngân sách, xã hội hoá),
-- còn "phương thức hình thành" lại chứa cách tài sản về trường (mua sắm, được cấp, tài trợ).
-- Từ đây:
--   * Nguồn hình thành = tài sản về trường bằng cách nào, sáu giá trị cố định. Mã của sáu dòng trùng
--     tên hằng của OriginRule trong code, vì luật rẽ nhánh theo từng giá trị.
--   * Nguồn tiền là nguồn kinh phí (cột funding_source), không còn nằm ở danh mục này.
--   * Phương thức hình thành = hình thức mua sắm (đấu thầu, chỉ định thầu…), chỉ có nghĩa khi mua sắm.

-- ---------------------------------------------------------------- sáu nguồn hình thành
UPDATE origin_sources SET name = 'Nguồn khác (cũ)' WHERE code = 'KHAC';

INSERT INTO origin_sources (code, name, sort_order, active, created_at) VALUES
  ('MUA_SAM',      'Mua sắm',            1, true, now()),
  ('PHAN_BO',      'Được Sở phân bổ',    2, true, now()),
  ('TANG_TAI_TRO', 'Được tặng, tài trợ', 3, true, now()),
  ('KIEM_KE_THUA', 'Kiểm kê thừa',       4, true, now()),
  ('TU_LAM',       'Đơn vị tự làm',      5, true, now())
ON CONFLICT (code) DO NOTHING;

UPDATE origin_sources SET name = 'Khác', sort_order = 6, active = true, updated_at = now() WHERE code = 'KHAC';

-- Nguồn hình thành mới của tài sản và phiếu nhập: suy từ phương thức hình thành cũ (nói đúng cách
-- tài sản về trường), không có thì suy từ nguồn tiền cũ.
CREATE TEMPORARY TABLE origin_of_acquisition ON COMMIT DROP AS
SELECT a.id AS acquisition_id, o.id AS origin_id
FROM acquisition_methods a
JOIN origin_sources o ON o.code = CASE a.code
        WHEN 'MUASAM'  THEN 'MUA_SAM'
        WHEN 'DUOCCAP' THEN 'PHAN_BO'
        WHEN 'TAITRO'  THEN 'TANG_TAI_TRO'
        WHEN 'TULAM'   THEN 'TU_LAM'
        ELSE 'KHAC'
    END;

CREATE TEMPORARY TABLE origin_of_money ON COMMIT DROP AS
SELECT old.id AS old_id, o.id AS origin_id
FROM origin_sources old
JOIN origin_sources o ON o.code = CASE
        WHEN old.code IN ('NSNN', 'SUNGHIEP') THEN 'MUA_SAM'
        WHEN old.code IN ('XHH', 'TAITRO') THEN 'TANG_TAI_TRO'
        ELSE 'KHAC'
    END
WHERE old.code NOT IN ('MUA_SAM', 'PHAN_BO', 'TANG_TAI_TRO', 'KIEM_KE_THUA', 'TU_LAM', 'KHAC');

UPDATE equipment e SET origin_source_id = m.origin_id
FROM origin_of_acquisition m WHERE e.acquisition_method_id = m.acquisition_id;
UPDATE equipment e SET origin_source_id = m.origin_id
FROM origin_of_money m WHERE e.origin_source_id = m.old_id;

UPDATE equipment_intakes i SET origin_source_id = m.origin_id
FROM origin_of_acquisition m WHERE i.acquisition_method_id = m.acquisition_id;
UPDATE equipment_intakes i SET origin_source_id = m.origin_id
FROM origin_of_money m WHERE i.origin_source_id = m.old_id;

DELETE FROM origin_sources
WHERE code NOT IN ('MUA_SAM', 'PHAN_BO', 'TANG_TAI_TRO', 'KIEM_KE_THUA', 'TU_LAM', 'KHAC');

-- Danh mục cố định: không vai nào thêm, sửa, xoá được nữa (máy chủ cũng từ chối).
DELETE FROM role_permissions rp
USING permissions p
WHERE p.id = rp.permission_id
  AND p.code IN ('origin_sources:write', 'origin_sources:delete');

-- ---------------------------------------------------------------- hình thức mua sắm
-- Giá trị cũ đã chuyển thành nguồn hình thành ở trên; hình thức mua sắm cụ thể thì dữ liệu cũ không
-- có, nên để trống cho người dùng khai lại.
UPDATE equipment SET acquisition_method_id = NULL WHERE acquisition_method_id IS NOT NULL;
UPDATE equipment_intakes SET acquisition_method_id = NULL WHERE acquisition_method_id IS NOT NULL;
UPDATE equipment_intake_lines SET acquisition_method_id = NULL WHERE acquisition_method_id IS NOT NULL;

DELETE FROM acquisition_methods WHERE code IN ('MUASAM', 'DUOCCAP', 'TAITRO', 'TULAM');

INSERT INTO acquisition_methods (code, name, sort_order, active, created_at) VALUES
  ('TAP_TRUNG',     'Mua sắm tập trung', 1, true, now()),
  ('DAU_THAU',      'Đấu thầu',          2, true, now()),
  ('CHI_DINH_THAU', 'Chỉ định thầu',     3, true, now()),
  ('MUA_TRUC_TIEP', 'Mua trực tiếp',     4, true, now())
ON CONFLICT (code) DO NOTHING;

UPDATE acquisition_methods SET sort_order = 9 WHERE code = 'KHAC';

--rollback SELECT 1;
