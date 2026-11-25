--liquibase formatted sql

--changeset qltb:158-unrepairable-after-repair
-- Trạng thái riêng cho tài sản có kết luận không sửa được từ phiếu sửa chữa.
-- Chỉ chuyển dữ liệu cũ nếu lần đổi trạng thái gần nhất chính là kết quả của phiếu sửa chữa đó.
-- Kết luận ghi thẳng trên phiếu báo hỏng cũ không được coi là kết quả sửa chữa.
UPDATE equipment e
SET status = 'UNREPAIRABLE'
FROM equipment_history h
JOIN repair_orders r ON r.id = h.voucher_id AND h.voucher_resource = 'repair_orders'
JOIN repair_order_lines l ON l.order_id = r.id AND l.equipment_id = h.equipment_id
WHERE e.id = h.equipment_id
  AND e.status = 'BROKEN'
  AND h.field = 'status'
  AND h.id = (SELECT max(newer.id) FROM equipment_history newer
              WHERE newer.equipment_id = e.id AND newer.field = 'status')
  AND r.result = 'UNREPAIRABLE';

