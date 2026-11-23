--liquibase formatted sql

-- Kiểm nhận điều chuyển theo từng tài sản: trường nhận đối chiếu đồ thật với phiếu, mỗi dòng một kết quả —
-- thay cho một câu chữ tự do "thiếu 1 máy chiếu…". Phần mềm đếm được chênh lệch, trường chuyển thấy đúng tài sản nào.
--
--   receipt_result      NULL = chưa kiểm; RECEIVED = nhận (có, đúng tình trạng → sang sổ trường nhận);
--                       RETURNED = trả lại (có nhưng hỏng / sai → ở lại sổ trường chuyển);
--                       MISSING = không thấy (không tới → ở lại sổ trường chuyển)
--   received_condition  tình trạng thực của tài sản bị trả lại (vd. HONG)
--   receive_note        ghi chú của trường nhận cho dòng đó (lý do trả lại, "không có trên xe")
--
-- Phiếu đã nhận trước đây là nhận đủ cả phiếu (chưa có kiểm theo dòng) → đánh dấu mọi dòng RECEIVED.

--changeset qltb:180-transfer-receipt-check
ALTER TABLE equipment_transfer_lines ADD COLUMN IF NOT EXISTS receipt_result VARCHAR(20);
ALTER TABLE equipment_transfer_lines ADD COLUMN IF NOT EXISTS received_condition VARCHAR(20);
ALTER TABLE equipment_transfer_lines ADD COLUMN IF NOT EXISTS receive_note VARCHAR(500);
ALTER TABLE equipment_transfer_lines DROP CONSTRAINT IF EXISTS ck_equipment_transfer_lines_receipt_result;
ALTER TABLE equipment_transfer_lines ADD CONSTRAINT ck_equipment_transfer_lines_receipt_result
    CHECK (receipt_result IS NULL OR receipt_result IN ('RECEIVED', 'RETURNED', 'MISSING'));

UPDATE equipment_transfer_lines l SET receipt_result = 'RECEIVED'
FROM equipment_transfers t
WHERE t.id = l.transfer_id AND t.status = 'COMPLETED' AND l.receipt_result IS NULL;

-- Trường NHẬN không thấy phiếu nháp của trường chuyển: phiếu đang soạn dở (có khi bị xoá) hiện bên nhận dễ hiểu
-- nhầm "sắp có đồ về". Trường nhận thấy phiếu từ lúc đã trình. Chỉ đổi đúng các dòng còn nguyên như `057` / `125`
-- đặt — dòng đã được quản lý sửa tay thì để yên.
--changeset qltb:180-transfer-receiver-sees-submitted
UPDATE row_level_policy p
SET scope = '{"any": [{"op": "eq", "field": "school.id", "value": {"ctx": "user.schoolId"}},
                      {"all": [{"op": "eq", "field": "targetSchool.id", "value": {"ctx": "user.schoolId"}},
                               {"op": "ne", "field": "status", "value": {"lit": "DRAFT"}}]}]}'::jsonb
FROM roles r
WHERE r.id = p.role_id AND p.resource = 'equipment_transfers' AND p.action = 'read' AND p.kind = 'SCOPE'
  AND r.code IN ('SCHOOL_STAFF', 'SUBJECT_HEAD')
  AND p.scope = '{"any": [{"op": "eq", "field": "school.id", "value": {"ctx": "user.schoolId"}},
                          {"op": "eq", "field": "targetSchool.id", "value": {"ctx": "user.schoolId"}}]}'::jsonb;

UPDATE row_level_policy p
SET scope = '{"all": [{"any": [{"op": "eq", "field": "school.id", "value": {"ctx": "user.schoolId"}},
                               {"all": [{"op": "eq", "field": "targetSchool.id", "value": {"ctx": "user.schoolId"}},
                                        {"op": "ne", "field": "status", "value": {"lit": "DRAFT"}}]}]},
                      {"any": [{"op": "ne", "field": "status", "value": {"lit": "DRAFT"}},
                               {"op": "isNotNull", "field": "returnNote"}]}]}'::jsonb
FROM roles r
WHERE r.id = p.role_id AND p.resource = 'equipment_transfers' AND p.action = 'read' AND p.kind = 'SCOPE'
  AND r.code = 'SCHOOL_LEADER'
  AND p.scope = '{"all": [{"any": [{"op": "eq", "field": "school.id", "value": {"ctx": "user.schoolId"}},
                                   {"op": "eq", "field": "targetSchool.id", "value": {"ctx": "user.schoolId"}}]},
                          {"any": [{"op": "ne", "field": "status", "value": {"lit": "DRAFT"}},
                                   {"op": "isNotNull", "field": "returnNote"}]}]}'::jsonb;
