--liquibase formatted sql

--changeset luudong:295-gon-ho-so-thiet-bi
--comment Hồ sơ thiết bị bỏ ba thứ thừa. Thông tin khác gộp vào Ghi chú. Giá trị còn lại luôn bằng nguyên giá (không có khấu hao). Quy cách bao bì của lô không còn đoạn code nào ghi
UPDATE equipment
SET note = LEFT(CASE WHEN note IS NULL OR btrim(note) = '' THEN btrim(other_info)
                     ELSE note || ' · ' || btrim(other_info) END, 500)
WHERE other_info IS NOT NULL AND btrim(other_info) <> '';
ALTER TABLE equipment
    DROP CONSTRAINT IF EXISTS ck_equipment_pack,
    DROP COLUMN pack_unit_id,
    DROP COLUMN pack_size,
    DROP COLUMN remaining_value,
    DROP COLUMN other_info;
--rollback ALTER TABLE equipment ADD COLUMN other_info VARCHAR(500), ADD COLUMN remaining_value NUMERIC(18, 2), ADD COLUMN pack_size NUMERIC(14, 3), ADD COLUMN pack_unit_id BIGINT REFERENCES units (id);
