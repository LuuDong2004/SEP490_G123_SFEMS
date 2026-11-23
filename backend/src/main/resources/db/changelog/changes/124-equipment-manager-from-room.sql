--liquibase formatted sql

-- Tài sản nằm trong một phòng có cán bộ phụ trách mà người quản lý còn trống: điền cán bộ phụ trách phòng.
--
-- Trước đây ghi tăng chỉ đặt PHÒNG cho tài sản, không đặt người quản lý; thu hồi về kho và nhận điều chuyển
-- còn xoá người quản lý đi. Tài sản về kho là đang nằm trong tay thủ kho, nên hồ sơ để trống là nói sai, và
-- cán bộ phải mở từng hồ sơ ra điền tay (phản hồi của BA). Từ nay các phiếu đó điền người nhận, không có thì
-- cán bộ phụ trách phòng (`EquipmentLifecycle.keeperOf`); changelog này làm cùng việc đó một lần cho tài sản
-- đã vào sổ trước.
--
-- Chỉ chạm tài sản đang TRONG KHO hoặc ĐANG SỬ DỤNG — đang mượn, hỏng, sửa, điều chuyển… là do phiếu khác
-- đang giữ, không tự đoán người giữ. Cán bộ phải cùng trường với tài sản. Phòng chưa khai cán bộ phụ trách
-- thì không có ai để điền, tài sản giữ nguyên. Ghi lịch sử TRƯỚC khi cập nhật, vì sau đó không còn phân
-- biệt được dòng nào vừa được điền.

--changeset qltb:124-equipment-manager-from-room
INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, note, created_at)
SELECT e.id, 'CAP_NHAT', 'manager', NULL, s.name,
       'Điền cán bộ phụ trách phòng ' || r.name || ' làm người quản lý', now()
FROM equipment e
JOIN rooms r ON r.id = e.room_id
JOIN staff s ON s.id = r.managing_staff_id
WHERE e.manager_id IS NULL
  AND e.status IN ('IN_STOCK', 'IN_USE')
  AND s.school_id = e.school_id;

UPDATE equipment e
SET manager_id = r.managing_staff_id
FROM rooms r
JOIN staff s ON s.id = r.managing_staff_id
WHERE r.id = e.room_id
  AND e.manager_id IS NULL
  AND e.status IN ('IN_STOCK', 'IN_USE')
  AND s.school_id = e.school_id;
--rollback SELECT 1;
