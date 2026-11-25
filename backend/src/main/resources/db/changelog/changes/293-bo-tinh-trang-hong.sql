--liquibase formatted sql

--changeset luudong:293-bo-tinh-trang-hong splitStatements:false
--comment Bỏ tình trạng và trạng thái Hỏng: báo hỏng phải có phiếu, mà phiếu báo hỏng ngoài phạm vi đồ án
-- Tình trạng còn Tốt, Trung bình, Kém. Trạng thái còn Trong kho, Đang sử dụng, Mất. Thiết bị đang ghi Hỏng quy về Kém, mỗi
-- cái một dòng lịch sử để biết trước đó ghi gì.
INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, note, created_at)
SELECT id, 'CAP_NHAT', 'condition', 'Hỏng', 'Kém', 'Bỏ tình trạng Hỏng', now() FROM equipment WHERE condition = 'HONG';
UPDATE equipment SET condition = 'KEM' WHERE condition = 'HONG';
UPDATE equipment SET status = CASE WHEN room_id IS NULL THEN 'IN_STOCK' ELSE 'IN_USE' END WHERE status = 'BROKEN';
UPDATE inventory_lines SET expected_condition = 'KEM' WHERE expected_condition = 'HONG';
UPDATE inventory_lines SET found_condition = 'KEM' WHERE found_condition = 'HONG';
ALTER TABLE school_year_closing_lines DROP COLUMN IF EXISTS broken;
