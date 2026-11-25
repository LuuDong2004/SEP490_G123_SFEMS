--liquibase formatted sql

--changeset qltb:136-destruction-asset-status
-- Existing destruction vouchers used liquidation statuses and history actions.
UPDATE equipment e
SET status = 'PENDING_DESTRUCTION'
FROM disposal_lines dl JOIN disposals d ON d.id = dl.disposal_id
WHERE e.id = dl.equipment_id AND d.kind = 'DESTRUCTION'
  AND d.status = 'APPROVED' AND e.status = 'PENDING_LIQUIDATION';

UPDATE equipment e
SET status = 'DESTROYED'
FROM disposal_lines dl JOIN disposals d ON d.id = dl.disposal_id
WHERE e.id = dl.equipment_id AND d.kind = 'DESTRUCTION'
  AND d.status = 'COMPLETED' AND e.status = 'LIQUIDATED';

UPDATE equipment_history h
SET action = 'CHO_TIEU_HUY', to_value = 'Chờ tiêu hủy'
FROM disposals d
WHERE h.voucher_resource = 'disposals' AND h.voucher_id = d.id
  AND d.kind = 'DESTRUCTION' AND h.action = 'CHO_THANH_LY' AND h.field = 'status';

UPDATE equipment_history h
SET action = 'TIEU_HUY', to_value = 'Đã tiêu hủy'
FROM disposals d
WHERE h.voucher_resource = 'disposals' AND h.voucher_id = d.id
  AND d.kind = 'DESTRUCTION' AND h.action = 'THANH_LY' AND h.field = 'status';

UPDATE equipment_history h SET from_value = 'Chờ tiêu hủy'
FROM disposals d
WHERE h.voucher_resource = 'disposals' AND h.voucher_id = d.id
  AND d.kind = 'DESTRUCTION' AND h.action = 'TIEU_HUY' AND h.field = 'status'
  AND h.from_value = 'Chờ thanh lý';

--rollback UPDATE equipment e SET status = 'PENDING_LIQUIDATION' FROM disposal_lines dl JOIN disposals d ON d.id = dl.disposal_id WHERE e.id = dl.equipment_id AND d.kind = 'DESTRUCTION' AND d.status = 'APPROVED' AND e.status = 'PENDING_DESTRUCTION';
--rollback UPDATE equipment e SET status = 'LIQUIDATED' FROM disposal_lines dl JOIN disposals d ON d.id = dl.disposal_id WHERE e.id = dl.equipment_id AND d.kind = 'DESTRUCTION' AND d.status = 'COMPLETED' AND e.status = 'DESTROYED';
--rollback UPDATE equipment_history h SET action = 'CHO_THANH_LY', to_value = 'Chờ thanh lý' FROM disposals d WHERE h.voucher_resource = 'disposals' AND h.voucher_id = d.id AND d.kind = 'DESTRUCTION' AND h.action = 'CHO_TIEU_HUY' AND h.field = 'status';
--rollback UPDATE equipment_history h SET action = 'THANH_LY', from_value = 'Chờ thanh lý', to_value = 'Đã thanh lý' FROM disposals d WHERE h.voucher_resource = 'disposals' AND h.voucher_id = d.id AND d.kind = 'DESTRUCTION' AND h.action = 'TIEU_HUY' AND h.field = 'status';
