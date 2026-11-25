--liquibase formatted sql

--changeset qltb:133-consumption-equipment-lot
-- Phiếu cũ không ghi lô cụ thể: giữ null để hiển thị đúng dữ liệu lịch sử.
ALTER TABLE consumption_records ADD COLUMN equipment_id BIGINT REFERENCES equipment (id) ON DELETE RESTRICT;
CREATE INDEX ix_consumption_records_equipment ON consumption_records (equipment_id);
--rollback DROP INDEX ix_consumption_records_equipment;
--rollback ALTER TABLE consumption_records DROP COLUMN equipment_id;
