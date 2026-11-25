--liquibase formatted sql

--changeset qltb:206-room-opening-hours
-- Khung giờ hoạt động của phòng chức năng (QLTB-656, HSDT 3.2.2; BCKTKT 1.1.3, 2.3.1). Mượn phòng không có bảng giờ
-- tiết học (xem 145), nên lịch mở cửa theo NGÀY và BUỔI — cùng đơn vị với phiếu mượn phòng:
--   open_days      thứ trong tuần theo ISO (1 = Thứ 2 … 7 = Chủ nhật), cách nhau dấu phẩy; trống = mọi ngày.
--   open_sessions  SANG, CHIEU, TOI (sáng = tiết 1–5, chiều = tiết 6–10, tối); trống = mọi buổi.
-- Phiếu mượn phòng ngoài lịch thì bị từ chối; màn Trạng thái phòng hiện "Đóng cửa" ngoài lịch.
ALTER TABLE rooms
    ADD COLUMN open_days     VARCHAR(20)
        CONSTRAINT ck_rooms_open_days CHECK (open_days IS NULL OR open_days ~ '^[1-7](,[1-7])*$'),
    ADD COLUMN open_sessions VARCHAR(20)
        CONSTRAINT ck_rooms_open_sessions CHECK (open_sessions IS NULL OR open_sessions ~ '^(SANG|CHIEU|TOI)(,(SANG|CHIEU|TOI))*$');

--rollback ALTER TABLE rooms DROP COLUMN open_days, DROP COLUMN open_sessions;
