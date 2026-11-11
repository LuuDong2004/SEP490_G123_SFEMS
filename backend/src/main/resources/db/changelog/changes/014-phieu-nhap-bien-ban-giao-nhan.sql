--liquibase formatted sql

--changeset luudong:014-phieu-nhap-bien-ban-giao-nhan
--comment Phiếu nhập (PN-01, PN-02): biên bản giao nhận ở đầu phiếu và lý do tăng ở từng dòng — hai thứ bắt buộc khi trình.

-- ---------------------------------------------------------------- 1. Biên bản giao nhận
-- Người giao bắt buộc khi trình; các ô còn lại là nội dung biên bản, không bắt buộc.
ALTER TABLE equipment_intakes
    ADD COLUMN deliverer                VARCHAR(255),
    ADD COLUMN deliverer_representative VARCHAR(255),
    ADD COLUMN receiver                 VARCHAR(255),
    ADD COLUMN receiver_position        VARCHAR(255),
    ADD COLUMN storekeeper              VARCHAR(255),
    ADD COLUMN inspection_result        VARCHAR(20),
    ADD COLUMN handover_no              VARCHAR(100),
    ADD CONSTRAINT ck_equipment_intakes_inspection CHECK (
        inspection_result IS NULL OR inspection_result IN ('PASSED', 'PARTIAL', 'FAILED'));

-- ---------------------------------------------------------------- 2. Lý do tăng của từng dòng
ALTER TABLE equipment_intake_lines
    ADD COLUMN movement_reason_id BIGINT REFERENCES movement_reasons (id) ON DELETE RESTRICT;
CREATE INDEX ix_equipment_intake_lines_reason ON equipment_intake_lines (movement_reason_id);

-- Phiếu mẫu đã ghi tăng (012): điền cho đủ như một phiếu thật đã trình.
UPDATE equipment_intakes
SET deliverer = 'Nguyễn Văn Giao', deliverer_representative = 'Công ty CP Thiết bị Giáo dục Sài Gòn',
    receiver = 'Cán bộ thiết bị', receiver_position = 'Nhân viên thiết bị', inspection_result = 'PASSED',
    handover_no = 'BBGN-2025/087'
WHERE code = 'NK-2025-00001' AND deliverer IS NULL;

UPDATE equipment_intake_lines l
SET movement_reason_id = (SELECT id FROM movement_reasons WHERE code = 'MUAMOI')
FROM equipment_intakes i
WHERE i.id = l.intake_id AND i.status = 'COMPLETED' AND l.movement_reason_id IS NULL;

--rollback DROP INDEX ix_equipment_intake_lines_reason; ALTER TABLE equipment_intake_lines DROP COLUMN movement_reason_id; ALTER TABLE equipment_intakes DROP CONSTRAINT ck_equipment_intakes_inspection, DROP COLUMN deliverer, DROP COLUMN deliverer_representative, DROP COLUMN receiver, DROP COLUMN receiver_position, DROP COLUMN storekeeper, DROP COLUMN inspection_result, DROP COLUMN handover_no;
