--liquibase formatted sql

--changeset qltb:197-inventory-counted-quantity
-- Hoá chất, vật tư nhập theo lô (một mã, quản lý theo số lượng) kiểm kê theo SỐ LƯỢNG (QLTB-574): dòng biên bản nhớ
-- số lượng trên sổ lúc lập phiếu và số đếm được; đếm thiếu là chênh lệch "thiếu số lượng".
ALTER TABLE inventory_lines
    ADD COLUMN expected_quantity NUMERIC(18, 3),
    ADD COLUMN counted_quantity  NUMERIC(18, 3);
ALTER TABLE inventory_lines ADD CONSTRAINT ck_inventory_lines_counted CHECK (counted_quantity IS NULL OR counted_quantity >= 0);
--rollback ALTER TABLE inventory_lines DROP CONSTRAINT ck_inventory_lines_counted, DROP COLUMN counted_quantity, DROP COLUMN expected_quantity;
