--liquibase formatted sql

--changeset qltb:247-intake-line-serials
-- Số serial khai ngay lúc lập phiếu ghi tăng (form chốt 13/11/2026): mỗi dòng một số, viết hoa, bỏ khoảng trắng.
-- Lúc duyệt, thiết bị từng cái sinh từ dòng nhận lần lượt các số này.
ALTER TABLE equipment_intake_lines ADD COLUMN serial_numbers TEXT;
--rollback ALTER TABLE equipment_intake_lines DROP COLUMN serial_numbers;
