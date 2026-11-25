--liquibase formatted sql

--changeset qltb:198-allocation-recall-handover
-- Thu hồi nội bộ hai bên xác nhận (QLTB-582): bên đang giữ xác nhận đã bàn giao, rồi cán bộ kho xác nhận đã nhận
-- (= hoàn tất phiếu). Phiếu thu hồi cũ đã hoàn tất coi như đã bàn giao.
ALTER TABLE equipment_allocations
    ADD COLUMN handed_over_at    TIMESTAMPTZ,
    ADD COLUMN handed_over_by_id BIGINT REFERENCES users (id),
    ADD COLUMN handover_note     VARCHAR(500);
UPDATE equipment_allocations SET handed_over_at = completed_at WHERE kind = 'RECALL' AND status = 'COMPLETED';
--rollback ALTER TABLE equipment_allocations DROP COLUMN handover_note, DROP COLUMN handed_over_by_id, DROP COLUMN handed_over_at;
