--liquibase formatted sql

-- Nơi nhận của TỪNG cái trên dòng phiếu ghi tăng (trưởng nhóm 14/11/2026): 10 máy tính có thể 8 cái về phòng máy, 2 cái
-- về phòng giáo viên. Lưu theo VỊ TRÍ như số serial (247): dòng thứ i là id phòng của cái thứ i, dòng trống = theo phòng
-- nhận của cả dòng. Duyệt phiếu thì cái nào có phòng riêng về đúng phòng đó.

--changeset luudong:255-intake-unit-rooms
ALTER TABLE equipment_intake_lines ADD COLUMN unit_room_ids TEXT;
--rollback ALTER TABLE equipment_intake_lines DROP COLUMN unit_room_ids;
