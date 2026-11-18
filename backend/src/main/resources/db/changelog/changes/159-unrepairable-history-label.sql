--liquibase formatted sql

--changeset qltb:159-unrepairable-history-label
-- Đồng bộ nhãn lịch sử mới với tài sản cũ đã chuyển sang trạng thái không sửa được.
UPDATE equipment_history h
SET to_value = 'Hỏng, không sửa được'
FROM equipment e, repair_orders r
WHERE e.id = h.equipment_id
  AND e.status = 'UNREPAIRABLE'
  AND h.field = 'status'
  AND h.voucher_resource = 'repair_orders'
  AND r.id = h.voucher_id
  AND r.result = 'UNREPAIRABLE'
  AND h.id = (SELECT max(newer.id) FROM equipment_history newer
              WHERE newer.equipment_id = e.id AND newer.field = 'status');
