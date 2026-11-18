--liquibase formatted sql

-- Phiếu ghi tăng gắn với NĂM HỌC (QLTB-390), dòng vật tư tiêu hao / hoá chất mang HẠN SỬ DỤNG (QLTB-391).
--
-- Năm học của phiếu cũ lấy theo năm học chứa ngày nhập; ngày nhập rơi ngoài mọi năm học đã khai thì lấy
-- năm học hiện hành. Hạn sử dụng đi từ dòng phiếu xuống bản ghi tài sản lúc duyệt, như model và hãng —
-- cảnh báo sắp hết hạn đọc ở tài sản, không đọc ngược về phiếu.

--changeset qltb:123-intake-school-year-expiry
ALTER TABLE equipment_intakes ADD COLUMN school_year_id BIGINT REFERENCES school_years (id);
CREATE INDEX idx_equipment_intakes_school_year ON equipment_intakes (school_year_id);

UPDATE equipment_intakes i
SET school_year_id = (SELECT y.id FROM school_years y
                      WHERE i.intake_date BETWEEN y.start_date AND y.end_date
                      ORDER BY y.start_date DESC LIMIT 1);
UPDATE equipment_intakes
SET school_year_id = (SELECT id FROM school_years WHERE is_current LIMIT 1)
WHERE school_year_id IS NULL;

ALTER TABLE equipment_intake_lines ADD COLUMN expiry_date DATE;
ALTER TABLE equipment ADD COLUMN expiry_date DATE;
CREATE INDEX idx_equipment_expiry_date ON equipment (expiry_date) WHERE expiry_date IS NOT NULL;
