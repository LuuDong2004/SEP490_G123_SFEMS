--liquibase formatted sql

--changeset qltb:175-equipment-serial-index
-- Tra trùng số serial trong một trường (EquipmentService.requireUniqueSerial, hai lối nhập tệp).
-- Không UNIQUE: dữ liệu cũ có thể đã trùng, và tài sản đã ra khỏi sổ không giữ serial.
CREATE INDEX ix_equipment_school_serial ON equipment (school_id, lower(trim(serial_number)))
    WHERE serial_number IS NOT NULL;

--rollback DROP INDEX ix_equipment_school_serial;
