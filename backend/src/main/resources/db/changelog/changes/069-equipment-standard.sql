--liquibase formatted sql

--changeset qltb:069-equipment-legacy-code
-- Mã tài sản do hệ thống cấp theo chuẩn TT.TR.MH.LT.ST.NC. Mã cũ (từ sổ giấy, phần mềm
-- trước, tệp nhập) không vứt đi mà giữ ở đây — tem cũ dán trên thiết bị vẫn tra được.
ALTER TABLE equipment ADD COLUMN legacy_code VARCHAR(64);
CREATE INDEX ix_equipment_legacy_code ON equipment (school_id, legacy_code);
