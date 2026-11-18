--liquibase formatted sql

-- Phòng CHO MƯỢN được hay không (QLTB-350): ô chọn trên hồ sơ phòng, thay cho luật cứng "mọi loại trừ kho và
-- phòng học" mà ô Phòng của phiếu mượn phòng từng dùng. Mặc định theo luật cũ, để không phòng nào đổi cách
-- hiện trên phiếu mượn ngày đổi sang; máy chủ từ chối mượn phòng không cho mượn.

--changeset qltb:131-room-loanable
ALTER TABLE rooms ADD COLUMN loanable BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE rooms r SET loanable = FALSE
FROM room_types t
WHERE t.id = r.room_type_id AND t.code IN ('KHO', 'PHONG_HOC');
