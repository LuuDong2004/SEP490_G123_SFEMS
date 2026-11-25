--liquibase formatted sql

-- Điều chuyển được cả tài sản hỏng (theo trưởng nhóm): dòng phiếu nhớ trạng thái tài sản ngay trước khi gửi bàn giao,
-- để nhận xong / huỷ bàn giao thì tài sản hỏng vẫn là hỏng. Phiếu gửi trước đây để trống — về theo chỗ để như cũ.
--changeset qltb:187-transfer-status-before
ALTER TABLE equipment_transfer_lines ADD COLUMN IF NOT EXISTS status_before VARCHAR(30);
