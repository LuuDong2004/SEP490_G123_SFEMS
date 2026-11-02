--liquibase formatted sql

--changeset tutn:034-nam-hoc-hien-hanh
--comment Năm học có cờ hiện hành (DM-01): tại một thời điểm chỉ một năm học là hiện hành, giữ bằng unique index một phần. Thêm năm học 2023-2024 và đặt 2026-2027 là hiện hành.

ALTER TABLE school_years ADD COLUMN is_current boolean DEFAULT false NOT NULL;

-- Chỉ một dòng được mang is_current = true.
CREATE UNIQUE INDEX uq_school_years_current ON school_years USING btree (is_current) WHERE is_current;

INSERT INTO school_years (code, name, start_date, end_date, sort_order, created_at) VALUES
  ('2023-2024', 'Năm học 2023-2024', DATE '2023-09-05', DATE '2024-05-31', 5, now())
ON CONFLICT (code) DO NOTHING;

UPDATE school_years SET is_current = true WHERE code = '2026-2027';

--rollback DROP INDEX uq_school_years_current; ALTER TABLE school_years DROP COLUMN is_current; DELETE FROM school_years WHERE code = '2023-2024';
