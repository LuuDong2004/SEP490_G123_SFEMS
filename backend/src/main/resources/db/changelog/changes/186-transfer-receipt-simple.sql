--liquibase formatted sql

-- Kiểm nhận điều chuyển chỉ GHI NHẬN (theo trưởng nhóm): Đã nhận / Hỏng / Thiếu, một nút xác nhận, phiếu luôn hoàn
-- tất; sửa chữa, tìm lại, ghi giảm do mất là quyết định ngoài và lập PHIẾU KHÁC. Gỡ phần dữ liệu của luồng giao bù /
-- trường chuyển kiểm tra lại (184, 185 — đã chạy trên máy dev nên không sửa, dọn ở đây):
--  - phiếu còn chờ kiểm nhận: bỏ kết quả báo tạm, trường nhận kiểm nhận lại từ đầu; dòng giao bù thay thế giữ nguyên
--    là một dòng của phiếu;
--  - "Hỏng — trả lại" (RETURNED) đổi tên thành DAMAGED. Dòng cũ đã chốt giữ nguyên tài sản như lúc chốt.
--changeset qltb:186-transfer-receipt-simple
DROP TABLE IF EXISTS equipment_transfer_supplement_items;
DROP TABLE IF EXISTS equipment_transfer_supplements;
ALTER TABLE equipment_transfer_lines DROP COLUMN IF EXISTS replacement_for_line_id;
ALTER TABLE equipment_transfer_lines DROP COLUMN IF EXISTS reported_result;
ALTER TABLE equipment_transfer_lines DROP COLUMN IF EXISTS reported_condition;
ALTER TABLE equipment_transfer_lines DROP COLUMN IF EXISTS reported_note;
ALTER TABLE equipment_transfer_lines DROP COLUMN IF EXISTS sender_check;
ALTER TABLE equipment_transfer_lines DROP COLUMN IF EXISTS sender_check_note;
ALTER TABLE equipment_transfer_lines DROP COLUMN IF EXISTS sender_checked_at;
ALTER TABLE equipment_transfer_lines DROP COLUMN IF EXISTS sender_checked_by;
ALTER TABLE equipment_transfers DROP COLUMN IF EXISTS delivery_phase;
ALTER TABLE equipment_transfers DROP COLUMN IF EXISTS provisional_reported_at;

UPDATE equipment_transfer_lines l SET receipt_result = NULL, received_condition = NULL, receive_note = NULL
FROM equipment_transfers t WHERE t.id = l.transfer_id AND t.status = 'APPROVED';

ALTER TABLE equipment_transfer_lines DROP CONSTRAINT IF EXISTS ck_equipment_transfer_lines_receipt_result;
UPDATE equipment_transfer_lines SET receipt_result = 'DAMAGED' WHERE receipt_result = 'RETURNED';
ALTER TABLE equipment_transfer_lines ADD CONSTRAINT ck_equipment_transfer_lines_receipt_result
    CHECK (receipt_result IS NULL OR receipt_result IN ('RECEIVED', 'DAMAGED', 'MISSING'));
