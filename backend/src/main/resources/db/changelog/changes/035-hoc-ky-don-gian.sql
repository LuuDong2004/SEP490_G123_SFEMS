--liquibase formatted sql

--changeset tutn:035-hoc-ky-don-gian
--comment Học kỳ chỉ là danh mục lựa chọn (Học kỳ 1, Học kỳ 2, Cả năm), không gắn năm học và không có ngày: bỏ các cột của changelog 033 và thay dữ liệu mẫu.

-- Dữ liệu mẫu cũ gắn theo năm học (HK1-2025-2026…) không còn hợp với hình dạng mới.
DELETE FROM semesters WHERE code IN ('HK1-2025-2026', 'HK2-2025-2026', 'HK1-2026-2027', 'HK2-2026-2027');

ALTER TABLE semesters DROP CONSTRAINT fk_semesters_school_year;
ALTER TABLE semesters DROP CONSTRAINT ck_semesters_dates;
DROP INDEX idx_semesters_school_year;
ALTER TABLE semesters DROP COLUMN school_year_id;
ALTER TABLE semesters DROP COLUMN start_date;
ALTER TABLE semesters DROP COLUMN end_date;

INSERT INTO semesters (code, name, sort_order, created_at) VALUES
  ('HOC_KY_1', 'Học kỳ 1', 10, now()),
  ('HOC_KY_2', 'Học kỳ 2', 20, now()),
  ('CA_NAM',   'Cả năm',   30, now())
ON CONFLICT (code) DO NOTHING;

--rollback DELETE FROM semesters WHERE code IN ('HOC_KY_1','HOC_KY_2','CA_NAM'); ALTER TABLE semesters ADD COLUMN school_year_id bigint; ALTER TABLE semesters ADD COLUMN start_date date; ALTER TABLE semesters ADD COLUMN end_date date;
