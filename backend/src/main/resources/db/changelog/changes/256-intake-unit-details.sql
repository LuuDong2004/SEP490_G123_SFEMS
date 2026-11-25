--liquibase formatted sql

-- Model, hãng, bảo hành, thông tin khác theo TỪNG cái trên dòng phiếu ghi tăng (trưởng nhóm 14/11/2026): mỗi thiết bị
-- một hàng, ô nào cũng sao chép xuống các hàng dưới được, cái nào khác thì gõ khác. Lưu theo VỊ TRÍ như số serial (247)
-- và phòng nhận (255): dòng thứ i là giá trị của cái thứ i, trống = theo ô cùng tên của cả dòng.

--changeset luudong:256-intake-unit-details
ALTER TABLE equipment_intake_lines
    ADD COLUMN unit_models TEXT,
    ADD COLUMN unit_manufacturers TEXT,
    ADD COLUMN unit_warranty_months TEXT,
    ADD COLUMN unit_other_infos TEXT;
--rollback ALTER TABLE equipment_intake_lines DROP COLUMN unit_models, DROP COLUMN unit_manufacturers, DROP COLUMN unit_warranty_months, DROP COLUMN unit_other_infos;
