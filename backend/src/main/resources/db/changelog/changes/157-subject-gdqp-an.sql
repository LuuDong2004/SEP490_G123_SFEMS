--liquibase formatted sql

--changeset qltb:157-subject-gdqp-an
-- Giáo dục quốc phòng và an ninh — môn bắt buộc ở THPT của chương trình 2018 mà danh mục môn còn thiếu: tệp
-- dữ liệu đầu vào ghi môn giảng dạy "Giáo dục quốc phòng" bị bỏ qua vì không có môn để ghép.
-- Mã dạy học 31 là số còn trống kế tiếp (bảng mã chính thức ở 116 chỉ có 08…25; 26…30 là mã đang dùng ở dev),
-- CHƯA phải mã của Bộ — có bảng mã chính thức thì đổi bằng một changelog như 116.
INSERT INTO subjects (code, name, sort_order, active, teaching_code, created_at)
SELECT '31', 'Giáo dục quốc phòng và an ninh', COALESCE((SELECT MAX(sort_order) FROM subjects), 0) + 10, TRUE, '31', now()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Giáo dục quốc phòng và an ninh' OR code = '31');

INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, sort_order, created_at)
SELECT s.id, e.id, 'BAT_BUOC',
       COALESCE((SELECT MAX(sort_order) FROM subject_education_levels WHERE education_level_id = e.id), 0) + 1, now()
FROM subjects s
JOIN education_levels e ON e.code = 'THPT'
WHERE s.name = 'Giáo dục quốc phòng và an ninh'
  AND NOT EXISTS (SELECT 1 FROM subject_education_levels x WHERE x.subject_id = s.id AND x.education_level_id = e.id);
--rollback DELETE FROM subject_education_levels WHERE subject_id = (SELECT id FROM subjects WHERE name = 'Giáo dục quốc phòng và an ninh'); DELETE FROM subjects WHERE name = 'Giáo dục quốc phòng và an ninh';
