--liquibase formatted sql

--changeset qltb:138-loan-usage-room
-- QLTB-480: phiếu mượn ghi PHÒNG SỬ DỤNG; ghi nhận mượn thì vị trí tài sản theo phòng đó, trả thì về
-- phòng cũ. Phòng cũ được nhớ trên từng dòng, như trạng thái cũ (status_before).
-- Phiếu cũ để trống cả hai cột: chúng chưa từng dời tài sản, nên lúc trả cũng không dời.
ALTER TABLE equipment_loans
    ADD COLUMN usage_room_id BIGINT REFERENCES rooms (id) ON DELETE RESTRICT;

ALTER TABLE equipment_loan_lines
    ADD COLUMN room_before_id BIGINT REFERENCES rooms (id) ON DELETE RESTRICT;

--rollback ALTER TABLE equipment_loan_lines DROP COLUMN room_before_id;
--rollback ALTER TABLE equipment_loans DROP COLUMN usage_room_id;
