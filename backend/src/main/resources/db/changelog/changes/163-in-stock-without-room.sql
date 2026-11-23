--liquibase formatted sql

-- QLTB-580: tài sản "Trong kho" mà chưa có vị trí → xếp vào kho của trường, người quản lý là cán bộ phụ trách kho.
--
-- Nhận điều chuyển chọn "Kho (chưa cấp phát)" và thu hồi để trống "Kho nhận" từng ghi phòng TRỐNG: trạng thái
-- vẫn "Trong kho" nhưng hồ sơ không có vị trí, không có người quản lý. Từ nay hai phiếu đó tìm kho của trường như
-- ghi tăng (`RoomService.storeroomOf`); changelog này làm cùng việc một lần cho tài sản đã nhận trước.
--
-- Kho của trường tìm đúng luật `storeroomOf`: phòng đang dùng mang loại KHO (tên nhỏ nhất trước), không có thì
-- phòng có chữ "kho" đứng riêng trong tên. Trường chưa khai kho thì tài sản giữ nguyên. Người quản lý chỉ điền
-- khi đang trống và cán bộ cùng trường. Ghi lịch sử TRƯỚC khi cập nhật, như `124`.

--changeset qltb:163-in-stock-without-room
INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, note, created_at)
SELECT e.id, 'CAP_NHAT', 'room', NULL, k.name,
       'Xếp vào kho của trường — nhận về kho trước đây chưa ghi kho', now()
FROM equipment e
JOIN (SELECT DISTINCT ON (r.school_id) r.school_id, r.id, r.name, r.managing_staff_id
      FROM rooms r LEFT JOIN room_types t ON t.id = r.room_type_id
      WHERE r.active AND (t.code = 'KHO' OR r.name ~* '(^|\s)kho(\s|$)')
      ORDER BY r.school_id, COALESCE(t.code = 'KHO', FALSE) DESC, r.name) k ON k.school_id = e.school_id
WHERE e.status = 'IN_STOCK' AND e.room_id IS NULL;

INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, note, created_at)
SELECT e.id, 'CAP_NHAT', 'manager', NULL, s.name,
       'Điền cán bộ phụ trách kho ' || k.name || ' làm người quản lý', now()
FROM equipment e
JOIN (SELECT DISTINCT ON (r.school_id) r.school_id, r.id, r.name, r.managing_staff_id
      FROM rooms r LEFT JOIN room_types t ON t.id = r.room_type_id
      WHERE r.active AND (t.code = 'KHO' OR r.name ~* '(^|\s)kho(\s|$)')
      ORDER BY r.school_id, COALESCE(t.code = 'KHO', FALSE) DESC, r.name) k ON k.school_id = e.school_id
JOIN staff s ON s.id = k.managing_staff_id AND s.school_id = e.school_id
WHERE e.status = 'IN_STOCK' AND e.room_id IS NULL AND e.manager_id IS NULL;

UPDATE equipment e
SET room_id = k.id,
    manager_id = COALESCE(e.manager_id, CASE WHEN s.school_id = e.school_id THEN k.managing_staff_id END)
FROM (SELECT DISTINCT ON (r.school_id) r.school_id, r.id, r.managing_staff_id
      FROM rooms r LEFT JOIN room_types t ON t.id = r.room_type_id
      WHERE r.active AND (t.code = 'KHO' OR r.name ~* '(^|\s)kho(\s|$)')
      ORDER BY r.school_id, COALESCE(t.code = 'KHO', FALSE) DESC, r.name) k
LEFT JOIN staff s ON s.id = k.managing_staff_id
WHERE k.school_id = e.school_id AND e.status = 'IN_STOCK' AND e.room_id IS NULL;
--rollback SELECT 1;
