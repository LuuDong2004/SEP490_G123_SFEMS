--liquibase formatted sql

--changeset qltb:135-disposal-reason-detail
-- Drafts may wait for a reason; existing submitted vouchers already have one.
ALTER TABLE disposals ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE disposals ADD COLUMN reason_detail VARCHAR(500);

--rollback ALTER TABLE disposals DROP COLUMN reason_detail;
--rollback UPDATE disposals SET reason = 'KHONG_SUA_DUOC' WHERE reason IS NULL;
--rollback ALTER TABLE disposals ALTER COLUMN reason SET NOT NULL;
