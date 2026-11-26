--liquibase formatted sql

--changeset luudong:306-dot-kiem-ke-theo-nam-hoc
--comment Đợt kiểm kê thuộc một năm học: Sở phát động theo năm học đang làm việc, danh sách đợt lọc theo năm học trên header. Đợt thuộc năm học bắt đầu gần nhất trước ngày chốt số liệu (kiểm kê cuối năm hay chốt vào hè, vẫn thuộc năm học vừa qua).
ALTER TABLE inventory_campaigns ADD COLUMN school_year_id BIGINT REFERENCES school_years (id) ON DELETE RESTRICT;
CREATE INDEX ix_inventory_campaigns_school_year ON inventory_campaigns (school_year_id);

-- Đợt đã có: gán theo ngày chốt.
UPDATE inventory_campaigns c SET school_year_id = (
    SELECT y.id FROM school_years y WHERE y.start_date <= c.cutoff_date ORDER BY y.start_date DESC LIMIT 1)
WHERE c.school_year_id IS NULL;
--rollback DROP INDEX ix_inventory_campaigns_school_year; ALTER TABLE inventory_campaigns DROP COLUMN school_year_id;
