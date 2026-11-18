--liquibase formatted sql

-- Phòng chỉ còn MỘT trạng thái trên màn hình: "Tình trạng sử dụng". Cờ hoạt động chung của danh mục
-- (`active`) không còn ô riêng mà máy chủ suy từ nó (`RoomService.reconcile`): ngừng sử dụng thì
-- không hiện trong các ô chọn, và phiếu nhập không ghi được vào phòng đó.
--
-- Dữ liệu cũ có hai cờ lệch nhau: phòng đã tắt "Đang hoạt động" mà tình trạng vẫn "Đang sử dụng"
-- thì chuyển tình trạng sang Ngừng sử dụng (giữ đúng ý người đã tắt), rồi đặt lại cờ cho mọi phòng.

--changeset qltb:107-room-active-from-usage
UPDATE rooms SET usage_status = 'NGUNG_SU_DUNG' WHERE active = FALSE AND usage_status IS DISTINCT FROM 'NGUNG_SU_DUNG';
UPDATE rooms SET active = (usage_status IS DISTINCT FROM 'NGUNG_SU_DUNG');
