--liquibase formatted sql

--changeset qltb:132-allocation-line-quantities
-- Phiếu cũ không có số lượng đã bàn giao; giữ null thay vì suy đoán từ tồn hiện tại.
ALTER TABLE equipment_allocation_lines ADD COLUMN quantity NUMERIC(14, 3);
ALTER TABLE equipment_allocation_lines ADD COLUMN stock_before NUMERIC(14, 3);
ALTER TABLE equipment_allocation_lines ADD COLUMN transferred_equipment_id BIGINT REFERENCES equipment (id) ON DELETE RESTRICT;
--rollback ALTER TABLE equipment_allocation_lines DROP COLUMN transferred_equipment_id;
--rollback ALTER TABLE equipment_allocation_lines DROP COLUMN stock_before;
--rollback ALTER TABLE equipment_allocation_lines DROP COLUMN quantity;
