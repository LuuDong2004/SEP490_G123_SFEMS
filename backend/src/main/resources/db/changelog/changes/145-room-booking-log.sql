--liquibase formatted sql

--changeset qltb:145-room-booking-log
-- Mượn phòng chỉ là GHI NHẬN như mượn trả thiết bị (QLTB-529): không qua lãnh đạo trường duyệt — trình là
-- "đang mượn", trả phòng là xong. Luồng mặc định (ApprovalFlowType.ROOM_BOOKINGS) đổi thành rỗng; dòng cấu
-- hình đè (nếu có) bị gỡ, nếu không nó vẫn kéo phiếu qua bước trường. Phiếu đang chờ duyệt thì coi như đã
-- ghi nhận.
DELETE FROM approval_flows WHERE resource = 'room_bookings';
UPDATE room_bookings SET status = 'APPROVED', approval_step = NULL WHERE status = 'PENDING';

-- Trả phòng ghi tình trạng phòng lúc trả (QLTB-530), như "tình trạng khi trả" của phiếu mượn thiết bị.
ALTER TABLE room_bookings ADD COLUMN room_condition VARCHAR(20);
ALTER TABLE room_bookings ADD COLUMN room_condition_note VARCHAR(500);
ALTER TABLE room_bookings ADD COLUMN returned_at TIMESTAMP;
ALTER TABLE room_bookings ADD CONSTRAINT ck_room_bookings_room_condition
    CHECK (room_condition IS NULL OR room_condition IN ('GOOD', 'ISSUE'));
COMMENT ON COLUMN room_bookings.room_condition IS 'Tình trạng phòng lúc trả: GOOD bình thường, ISSUE có vấn đề (ghi rõ ở room_condition_note). Khác return_note — lý do trả phiếu về người lập';

-- Thư viện, phòng "Khác" và phòng chưa phân loại không cho mượn theo mặc định (QLTB-524) — trước đó chỉ kho và
-- phòng học bị loại. Trường muốn cho mượn thì bật lại ô "Cho mượn" trên hồ sơ phòng.
UPDATE rooms r SET loanable = FALSE
WHERE r.loanable
  AND (r.room_type_id IS NULL
       OR EXISTS (SELECT 1 FROM room_types t WHERE t.id = r.room_type_id AND t.code IN ('THU_VIEN', 'KHAC')));
