--liquibase formatted sql

-- Mã môn dạy học theo BẢNG MÃ CHÍNH THỨC, thay bộ mã demo của 076 / 095.
--
-- 076 đặt 01…14 và 095 đặt 15…19 để môi trường demo chạy được, kèm lời dặn "phải thay bằng bảng mã
-- chính thức trước khi dùng thật". Bảng đó nay đã có: 18 môn 08…25. Sáu môn bảng không ghi lấy theo
-- giá trị đang dùng trên môi trường dev (nhập tay ngày 12/10/2026): Dùng chung giữ 00, năm môn của
-- chương trình 2018 nhận 26…30. Trước changelog này bộ mã mới chỉ tồn tại trong database của dev —
-- máy nào pull code về cũng vẫn mang bộ demo.
--
-- Khớp theo TÊN môn, không theo mã cũ: từ 113 `code` chính là mã dạy học, nên trên dev mã cũ không
-- còn, và khớp theo mã cũ ở đó sẽ đổi nhầm (08 đang là Toán chứ không còn là Tiếng Anh). Khớp theo
-- tên thì chạy được ở cả hai nơi và chạy lại không đổi gì: dòng đã mang mã đúng bị bỏ qua.
--
-- Hai bước vì các mã đổi chỗ cho nhau (Tiếng Anh 08 → 10 trong khi Toán 01 → 08) và `uq_subjects_code`
-- kiểm từng dòng ngay trong câu UPDATE: bước 1 đẩy các dòng cần đổi sang mã tạm có dấu '~', bước 2 gỡ
-- dấu đó.
--
-- KHÔNG đổi mã tài sản đã cấp. Đoạn MH của mã cũ giữ nguyên, nên một tài sản môn Toán cấp trước đây
-- vẫn mang 01. Mã mới không trùng mã cũ: bộ đếm tính theo cả chuỗi tiền tố (`equipment_code_sequences`),
-- tài sản Toán mới nối tiếp bộ đếm của tiền tố …08…. Đổi cả mã đã cấp là một bước riêng, phải có lịch
-- sử như 082, chờ quyết định nghiệp vụ.

--changeset qltb:116-subject-official-teaching-codes
UPDATE subjects s
SET code = '~' || v.code, teaching_code = '~' || v.code, updated_at = now()
FROM (VALUES
    ('Dùng chung', '00'),
    ('Toán', '08'), ('Ngữ văn', '09'), ('Tiếng Anh', '10'), ('Vật lý', '11'),
    ('Hóa học', '12'), ('Sinh học', '13'), ('Tin học', '14'), ('Lịch sử', '15'),
    ('Địa lý', '16'), ('Giáo dục công dân', '17'), ('Công nghệ', '18'), ('Mỹ thuật', '19'),
    ('Âm nhạc', '20'), ('Giáo dục thể chất', '21'), ('Hoạt động trải nghiệm', '22'),
    ('Ngoại ngữ khác', '23'), ('Khoa học (Tiểu học)', '24'), ('Tự nhiên và Xã hội (Tiểu học)', '25'),
    ('Giáo dục kinh tế và pháp luật', '26'), ('Khoa học tự nhiên', '27'),
    ('Lịch sử và Địa lí', '28'), ('Đạo đức', '29'), ('Tiếng Việt', '30')
) AS v(name, code)
WHERE s.name = v.name
  AND (s.code <> v.code OR s.teaching_code IS DISTINCT FROM v.code);

UPDATE subjects
SET code = substr(code, 2), teaching_code = substr(teaching_code, 2)
WHERE code LIKE '~%';
--rollback UPDATE subjects s SET code = '~' || v.code, teaching_code = '~' || v.code FROM (VALUES ('Toán','01'),('Vật lý','02'),('Hóa học','03'),('Sinh học','04'),('Ngữ văn','05'),('Lịch sử','06'),('Địa lý','07'),('Tiếng Anh','08'),('Tin học','09'),('Giáo dục công dân','10'),('Công nghệ','11'),('Âm nhạc','12'),('Mỹ thuật','13'),('Giáo dục thể chất','14'),('Tiếng Việt','15'),('Đạo đức','16'),('Lịch sử và Địa lí','17'),('Khoa học tự nhiên','18'),('Giáo dục kinh tế và pháp luật','19')) AS v(name, code) WHERE s.name = v.name; UPDATE subjects SET code = substr(code, 2), teaching_code = substr(teaching_code, 2) WHERE code LIKE '~%';
