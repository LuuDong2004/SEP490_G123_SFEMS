--liquibase formatted sql

-- Nguồn hình thành lên ĐẦU PHIẾU ghi tăng, danh mục Nguồn kinh phí mới, và hai thứ đó đi với nhau.
--
-- Trước changelog này một phiếu ghi tăng trả lời câu "tài sản này từ đâu ra" ở BA chỗ, không chỗ nào
-- ràng với chỗ nào: "Lý do tăng" ở từng dòng (danh mục lý do tăng giảm: mua sắm mới, được cấp, tài
-- trợ, tự làm, kiểm kê thừa…), "Nguồn hình thành" ở từng dòng (danh mục Sở tự khai, thực chất lại là
-- nguồn tiền: ngân sách, xã hội hoá, tài trợ…) và "Hình thức mua sắm" (lẫn cả "Được cấp", "Tặng/biếu").
-- Một dòng có thể ghi lý do "Tài trợ", nguồn hình thành "Ngân sách nhà nước", hình thức "Đấu thầu" —
-- và không báo cáo nào đếm được hàng được tặng.
--
-- Từ đây:
--   * Nguồn hình thành là SÁU giá trị cố định, một giá trị cho CẢ PHIẾU (một lần ghi tăng là một
--     nguồn): Mua sắm · Được Sở phân bổ · Được tặng, tài trợ · Kiểm kê thừa · Đơn vị tự làm · Khác.
--     Mã của sáu dòng là tên hằng của `OriginRule` trong code — luật rẽ nhánh theo từng giá trị.
--   * "Lý do tăng" của dòng bị bỏ: nó cùng nghĩa với nguồn hình thành. Giá trị đang có được chuyển
--     thành nguồn hình thành của phiếu trước khi gỡ.
--   * Nguồn kinh phí là NĂM nguồn chuẩn (Ngân sách · Học phí · Nguồn thu sự nghiệp · Quỹ phát triển sự
--     nghiệp · Tài trợ), cộng "Chưa xác định nguồn" do hệ thống ghi; nguồn nào chọn được do nguồn hình
--     thành quyết định (`OriginRule`).
--   * Hình thức mua sắm chỉ còn nghĩa khi nguồn hình thành là Mua sắm: "Được cấp", "Tặng/biếu" thôi
--     là lựa chọn, giá trị đang có chuyển thành nguồn hình thành tương ứng.
--   * Phiếu ghi tăng nhớ nó được lập từ phiếu nghiệp vụ nào (đề xuất mua sắm, biên bản kiểm kê).

--changeset qltb:109-origin-and-funding-sources

-- ---------------------------------------------------------------- cột mới

ALTER TABLE equipment_intakes
    ADD COLUMN origin_note     VARCHAR(255),
    ADD COLUMN source_resource VARCHAR(40),
    ADD COLUMN source_id       BIGINT,
    ADD COLUMN source_code     VARCHAR(50);

COMMENT ON COLUMN equipment_intakes.origin_note IS 'Ghi rõ khi nguồn hình thành là "Khác"';
COMMENT ON COLUMN equipment_intakes.source_resource IS 'Phiếu nghiệp vụ đã sinh ra phiếu ghi tăng này (purchase_proposals, inventory_sessions); null = lập tay';

ALTER TABLE equipment_intake_lines
    ADD COLUMN funding_note     VARCHAR(255),
    ADD COLUMN acquisition_note VARCHAR(255);
COMMENT ON COLUMN equipment_intake_lines.funding_note IS 'Ghi rõ khi nguồn kinh phí là "Nguồn hợp pháp khác"';

ALTER TABLE equipment
    ADD COLUMN origin_note      VARCHAR(255),
    ADD COLUMN funding_note     VARCHAR(255),
    ADD COLUMN acquisition_note VARCHAR(255);

COMMENT ON COLUMN equipment_intake_lines.acquisition_note IS 'Ghi rõ khi hình thức mua sắm là "Khác"';

-- ---------------------------------------------------------------- nguồn kinh phí: về năm nguồn chuẩn
-- Danh mục chuẩn do nghiệp vụ chốt: Ngân sách · Học phí · Nguồn thu sự nghiệp · Quỹ phát triển sự
-- nghiệp · Tài trợ. Giá trị cũ quy về:
--   STATE_BUDGET   (Ngân sách nhà nước)     → giữ, nay là "Ngân sách"
--   TARGET_PROGRAM (Chương trình mục tiêu)  → STATE_BUDGET: vẫn là tiền ngân sách
--   SOCIALIZATION  (Xã hội hóa)             → SPONSORSHIP: tiền người ngoài đóng góp
--   SPONSORSHIP, REVENUE                    → giữ
--   OTHER          (Nguồn khác)             → UNDETERMINED: không đoán thay người khai; "Chưa xác định
--                                             nguồn" vẫn là hồ sơ có nguồn kinh phí, tài sản không bị
--                                             đẩy về "hồ sơ chưa chuẩn"
-- Học phí và Quỹ phát triển sự nghiệp là nguồn mới, chưa dữ liệu nào mang.

UPDATE equipment              SET funding_source = 'STATE_BUDGET' WHERE funding_source = 'TARGET_PROGRAM';
UPDATE equipment_intakes      SET funding_source = 'STATE_BUDGET' WHERE funding_source = 'TARGET_PROGRAM';
UPDATE equipment_intake_lines SET funding_source = 'STATE_BUDGET' WHERE funding_source = 'TARGET_PROGRAM';
UPDATE purchase_proposals     SET funding_source = 'STATE_BUDGET' WHERE funding_source = 'TARGET_PROGRAM';

UPDATE equipment              SET funding_source = 'SPONSORSHIP' WHERE funding_source = 'SOCIALIZATION';
UPDATE equipment_intakes      SET funding_source = 'SPONSORSHIP' WHERE funding_source = 'SOCIALIZATION';
UPDATE equipment_intake_lines SET funding_source = 'SPONSORSHIP' WHERE funding_source = 'SOCIALIZATION';
UPDATE purchase_proposals     SET funding_source = 'SPONSORSHIP' WHERE funding_source = 'SOCIALIZATION';

UPDATE equipment              SET funding_source = 'UNDETERMINED' WHERE funding_source = 'OTHER';
UPDATE equipment_intakes      SET funding_source = 'UNDETERMINED' WHERE funding_source = 'OTHER';
UPDATE equipment_intake_lines SET funding_source = 'UNDETERMINED' WHERE funding_source = 'OTHER';
UPDATE purchase_proposals     SET funding_source = 'UNDETERMINED' WHERE funding_source = 'OTHER';

-- ---------------------------------------------------------------- nguồn hình thành: sáu dòng cố định
-- Dòng 'KHAC' đã có từ 019 thì giữ id (tài sản đang trỏ tới nó vẫn đúng nghĩa), chỉ đổi tên.

INSERT INTO origin_sources (code, name, sort_order, active, created_at)
SELECT v.code, v.name, v.sort_order, TRUE, now()
FROM (VALUES
    ('MUA_SAM',      'Mua sắm',            1),
    ('PHAN_BO',      'Được Sở phân bổ',    2),
    ('TANG_TAI_TRO', 'Được tặng, tài trợ', 3),
    ('KIEM_KE_THUA', 'Kiểm kê thừa',       4),
    ('TU_LAM',       'Đơn vị tự làm',      5),
    ('KHAC',         'Khác',               6)
) AS v(code, name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM origin_sources o WHERE o.code = v.code);

-- Tên cũ có thể trùng tên mới (ràng buộc tên duy nhất của danh mục): né trước khi đặt tên chuẩn.
UPDATE origin_sources SET name = name || ' (cũ)'
WHERE code NOT IN ('MUA_SAM', 'PHAN_BO', 'TANG_TAI_TRO', 'KIEM_KE_THUA', 'TU_LAM', 'KHAC');

UPDATE origin_sources o
SET name = v.name, sort_order = v.sort_order, active = TRUE, updated_at = now()
FROM (VALUES
    ('MUA_SAM',      'Mua sắm',            1),
    ('PHAN_BO',      'Được Sở phân bổ',    2),
    ('TANG_TAI_TRO', 'Được tặng, tài trợ', 3),
    ('KIEM_KE_THUA', 'Kiểm kê thừa',       4),
    ('TU_LAM',       'Đơn vị tự làm',      5),
    ('KHAC',         'Khác',               6)
) AS v(code, name, sort_order)
WHERE o.code = v.code;

-- Dòng cũ → dòng mới. Sáu giá trị cũ của 019 thật ra là nguồn TIỀN, nên chỉ đoán được tới mức này:
-- tiền ngân sách hay trường tự mua là mua sắm, còn xã hội hoá, tài trợ, viện trợ là được tặng. Dòng Sở tự
-- thêm (không biết nghĩa) về "Khác".
CREATE TEMPORARY TABLE origin_remap ON COMMIT DROP AS
SELECT o.id AS old_id, n.id AS new_id
FROM origin_sources o
JOIN origin_sources n ON n.code = CASE
        WHEN o.code IN ('NGAN_SACH', 'TU_MUA') THEN 'MUA_SAM'
        WHEN o.code IN ('XA_HOI_HOA', 'TAI_TRO', 'VIEN_TRO') THEN 'TANG_TAI_TRO'
        ELSE 'KHAC'
    END
WHERE o.code NOT IN ('MUA_SAM', 'PHAN_BO', 'TANG_TAI_TRO', 'KIEM_KE_THUA', 'TU_LAM', 'KHAC');

UPDATE equipment e              SET origin_source_id = m.new_id FROM origin_remap m WHERE e.origin_source_id = m.old_id;
UPDATE equipment_intakes i      SET origin_source_id = m.new_id FROM origin_remap m WHERE i.origin_source_id = m.old_id;
UPDATE equipment_intake_lines l SET origin_source_id = m.new_id FROM origin_remap m WHERE l.origin_source_id = m.old_id;

DELETE FROM origin_sources
WHERE code NOT IN ('MUA_SAM', 'PHAN_BO', 'TANG_TAI_TRO', 'KIEM_KE_THUA', 'TU_LAM', 'KHAC');

-- Danh mục cố định: không vai nào còn quyền ghi / xoá nó (máy chủ cũng từ chối), nên màn danh mục chỉ
-- còn để xem — nút Thêm, Sửa, Xoá tự ẩn theo quyền. Mã quyền vẫn nằm trong bảng, chỉ là không ai giữ.
DELETE FROM role_permissions rp
USING permissions p
WHERE p.id = rp.permission_id
  AND p.code IN ('origin_sources:write', 'origin_sources:delete');

-- ---------------------------------------------------------------- nguồn hình thành của PHIẾU
-- (1) "Lý do tăng" của dòng nói đúng điều nguồn hình thành cần nói — nó thắng giá trị đoán ở trên.
--     Lấy lý do của dòng đầu tiên có khai. GT05 (nhập lại sau sửa chữa) và GT99 không có nguồn tương
--     ứng: về "Khác", kèm tên lý do làm phần ghi rõ.
UPDATE equipment_intakes i
SET origin_source_id = o.id,
    origin_note = CASE WHEN o.code = 'KHAC' THEN left(r.reason_name, 255) ELSE i.origin_note END
FROM (
    SELECT DISTINCT ON (l.intake_id) l.intake_id, mr.code AS reason_code, mr.name AS reason_name
    FROM equipment_intake_lines l
    JOIN movement_reasons mr ON mr.id = NULLIF(l.details -> 'movementReason' ->> 'id', '')::BIGINT
    ORDER BY l.intake_id, l.line_no
) r
JOIN origin_sources o ON o.code = CASE r.reason_code
        WHEN 'GT01' THEN 'MUA_SAM'
        WHEN 'GT02' THEN 'PHAN_BO'
        WHEN 'GT03' THEN 'TANG_TAI_TRO'
        WHEN 'GT04' THEN 'TU_LAM'
        WHEN 'GT06' THEN 'KIEM_KE_THUA'
        ELSE 'KHAC'
    END
WHERE i.id = r.intake_id;

-- (2) Hình thức mua sắm "Được cấp", "Tặng/biếu" là nguồn hình thành viết nhầm chỗ.
UPDATE equipment_intakes i
SET origin_source_id = o.id
FROM acquisition_methods am, origin_sources o
WHERE i.origin_source_id IS NULL
  AND am.id = COALESCE(i.acquisition_method_id,
        (SELECT l.acquisition_method_id FROM equipment_intake_lines l
         WHERE l.intake_id = i.id AND l.acquisition_method_id IS NOT NULL ORDER BY l.line_no LIMIT 1))
  AND am.code IN ('DUOC_CAP', 'TANG')
  AND o.code = CASE am.code WHEN 'DUOC_CAP' THEN 'PHAN_BO' ELSE 'TANG_TAI_TRO' END;

-- (3) Phiếu chưa có nguồn ở đầu thì lấy của dòng đầu tiên có khai (khai theo dòng từ 085).
UPDATE equipment_intakes i
SET origin_source_id = (
    SELECT l.origin_source_id FROM equipment_intake_lines l
    WHERE l.intake_id = i.id AND l.origin_source_id IS NOT NULL
    ORDER BY l.line_no LIMIT 1)
WHERE i.origin_source_id IS NULL;

-- (4) Phiếu sinh từ đề xuất mua sắm là mua sắm, và nhớ luôn phiếu nguồn.
UPDATE equipment_intakes i
SET source_resource = 'purchase_proposals', source_id = p.id, source_code = p.code,
    origin_source_id = COALESCE(i.origin_source_id, (SELECT id FROM origin_sources WHERE code = 'MUA_SAM'))
FROM purchase_proposals p
WHERE p.intake_id = i.id;

-- (5) Còn lại: phiếu vẫn chưa có nguồn. Nguồn kinh phí tài trợ / xã hội hoá thì là được tặng, có nguồn
--     kinh phí khác thì là mua sắm — phần lớn phiếu ghi tăng là hàng mua. Phiếu không có cả nguồn kinh
--     phí thì để trống: phiếu nháp sẽ bị hỏi lúc trình, phiếu đã xong thì không đoán thay người lập.
UPDATE equipment_intakes i
SET origin_source_id = o.id
FROM origin_sources o
WHERE i.origin_source_id IS NULL
  AND o.code = CASE
        WHEN COALESCE(i.funding_source,
                (SELECT l.funding_source FROM equipment_intake_lines l
                 WHERE l.intake_id = i.id AND l.funding_source IS NOT NULL ORDER BY l.line_no LIMIT 1))
             IN ('SPONSORSHIP') THEN 'TANG_TAI_TRO'
        WHEN COALESCE(i.funding_source,
                (SELECT l.funding_source FROM equipment_intake_lines l
                 WHERE l.intake_id = i.id AND l.funding_source IS NOT NULL ORDER BY l.line_no LIMIT 1))
             IS NOT NULL THEN 'MUA_SAM'
    END;

-- Dòng không còn mang nguồn hình thành riêng, và không còn "Lý do tăng".
UPDATE equipment_intake_lines SET origin_source_id = NULL WHERE origin_source_id IS NOT NULL;
UPDATE equipment_intake_lines SET details = details - 'movementReason' WHERE jsonb_exists(details, 'movementReason');

-- ---------------------------------------------------------------- hình thức mua sắm
-- Chỉ hàng MUA mới có hình thức mua sắm. Gỡ nó khỏi phiếu / dòng không phải mua sắm, và thôi cho
-- chọn hai mục vốn là nguồn hình thành (giữ dòng: khoá ngoại RESTRICT, và để tra cứu dữ liệu cũ).
UPDATE equipment_intakes i
SET acquisition_method_id = NULL
WHERE i.acquisition_method_id IS NOT NULL
  AND i.origin_source_id IS DISTINCT FROM (SELECT id FROM origin_sources WHERE code = 'MUA_SAM');

UPDATE equipment_intake_lines l
SET acquisition_method_id = NULL
FROM equipment_intakes i
WHERE l.intake_id = i.id
  AND l.acquisition_method_id IS NOT NULL
  AND i.origin_source_id IS DISTINCT FROM (SELECT id FROM origin_sources WHERE code = 'MUA_SAM');

UPDATE acquisition_methods SET active = FALSE, updated_at = now() WHERE code IN ('DUOC_CAP', 'TANG');

-- ---------------------------------------------------------------- tài sản theo phiếu đã sinh ra nó
-- Tài sản ghi tăng qua phiếu mang đúng nguồn hình thành của phiếu đó — một nguồn sự thật. Tài sản khai
-- đầu kỳ (không có phiếu) giữ giá trị đã đổi ở trên.
UPDATE equipment e
SET origin_source_id = i.origin_source_id,
    origin_note = i.origin_note
FROM equipment_intake_lines l
JOIN equipment_intakes i ON i.id = l.intake_id
WHERE e.intake_line_id = l.id
  AND i.origin_source_id IS NOT NULL;

-- Tài sản khai đầu kỳ: hình thức "Được cấp" / "Tặng/biếu" thành nguồn hình thành khi chưa có.
UPDATE equipment e
SET origin_source_id = o.id
FROM acquisition_methods am, origin_sources o
WHERE e.origin_source_id IS NULL
  AND am.id = e.acquisition_method_id
  AND am.code IN ('DUOC_CAP', 'TANG')
  AND o.code = CASE am.code WHEN 'DUOC_CAP' THEN 'PHAN_BO' ELSE 'TANG_TAI_TRO' END;

UPDATE equipment e
SET acquisition_method_id = NULL
WHERE e.acquisition_method_id IS NOT NULL
  AND e.origin_source_id IS DISTINCT FROM (SELECT id FROM origin_sources WHERE code = 'MUA_SAM');

-- ---------------------------------------------------------------- phiếu nhớ phiếu nguồn
-- Phiếu nháp sinh từ biên bản kiểm kê trước đây chỉ để lại số biên bản trong ghi chú.
UPDATE equipment_intakes i
SET source_resource = 'inventory_sessions', source_id = s.id, source_code = s.code,
    origin_source_id = COALESCE(i.origin_source_id, (SELECT id FROM origin_sources WHERE code = 'KIEM_KE_THUA'))
FROM inventory_sessions s
WHERE i.source_resource IS NULL
  AND s.school_id = i.school_id
  AND s.code IS NOT NULL
  AND i.note = 'Ghi tăng tài sản thừa theo biên bản kiểm kê ' || s.code;
