--liquibase formatted sql

-- Trường CHUYỂN kiểm tra lại tài sản bị trường nhận trả về ("Hỏng — trả lại") hoặc báo "Không có": kết luận của chủ
-- tài sản nằm ngay trên dòng phiếu để cả hai trường cùng thấy — hỏng thật / không hỏng, đã tìm thấy / mất.

--changeset qltb:184-transfer-sender-check
ALTER TABLE equipment_transfer_lines ADD COLUMN IF NOT EXISTS sender_check VARCHAR(20);
ALTER TABLE equipment_transfer_lines ADD COLUMN IF NOT EXISTS sender_check_note VARCHAR(500);
ALTER TABLE equipment_transfer_lines ADD COLUMN IF NOT EXISTS sender_checked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE equipment_transfer_lines ADD COLUMN IF NOT EXISTS sender_checked_by VARCHAR(255);
