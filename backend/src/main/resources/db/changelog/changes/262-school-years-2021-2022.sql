--liquibase formatted sql

--changeset luudong:262-school-years-2021-2022
-- Năm học 2021-2022 và 2022-2023: bộ tiêu chuẩn thiết bị tối thiểu áp dụng từ các năm đó (TT 37/2021 hiệu lực
-- 14/02/2022, TT 38, 39/2021 cùng đợt) — thiếu thì ô "Năm học áp dụng" của bộ không chọn đúng được. Đẩy thứ tự các
-- năm đang có xuống hai bậc để danh sách vẫn xếp theo thời gian. Nối theo mã, không ghim id.
UPDATE school_years SET sort_order = COALESCE(sort_order, 0) + 2, updated_at = now()
WHERE code NOT IN ('2021-2022', '2022-2023');
INSERT INTO school_years (code, name, sort_order, active, start_date, end_date, is_current, created_at) VALUES
  ('2021-2022', 'Năm học 2021-2022', 1, TRUE, DATE '2021-09-05', DATE '2022-05-31', FALSE, now()),
  ('2022-2023', 'Năm học 2022-2023', 2, TRUE, DATE '2022-09-05', DATE '2023-05-31', FALSE, now())
ON CONFLICT (code) DO NOTHING;
--rollback DELETE FROM school_years WHERE code IN ('2021-2022', '2022-2023'); UPDATE school_years SET sort_order = sort_order - 2;
