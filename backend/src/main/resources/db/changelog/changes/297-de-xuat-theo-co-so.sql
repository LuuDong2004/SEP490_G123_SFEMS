--liquibase formatted sql

--changeset luudong:297-de-xuat-theo-co-so
--comment Đề xuất mua sắm ghi cơ sở của người lập. Tài khoản một cơ sở lập thì đề xuất thuộc cơ sở đó, trống là cơ sở chính
ALTER TABLE purchase_proposals ADD COLUMN campus_id BIGINT REFERENCES campuses (id);
CREATE INDEX IF NOT EXISTS ix_purchase_proposals_campus ON purchase_proposals (campus_id) WHERE campus_id IS NOT NULL;
--rollback DROP INDEX IF EXISTS ix_purchase_proposals_campus; ALTER TABLE purchase_proposals DROP COLUMN campus_id;
