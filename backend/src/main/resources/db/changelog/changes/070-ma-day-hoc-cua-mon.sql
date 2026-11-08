--liquibase formatted sql

--changeset nghianv:070-ma-day-hoc-cua-mon
--comment Mã dạy học 2 chữ số của môn: thành phần MH của mã tài sản TT.TR.MH.LT.ST.NC (DR-09). Môn chưa có
--comment mã thì thiết bị của môn đó không cấp được mã chuẩn (DR-10). Mã trong changeset này là DỮ LIỆU DEMO
--comment đặt theo thứ tự sort_order của 031; PHẢI thay bằng bảng mã chính thức trước khi dùng thật.

ALTER TABLE subjects ADD COLUMN teaching_code VARCHAR(2);

ALTER TABLE subjects ADD CONSTRAINT ck_subjects_teaching_code
    CHECK (teaching_code IS NULL OR teaching_code ~ '^[0-9]{2}$');

CREATE UNIQUE INDEX uq_subjects_teaching_code ON subjects (teaching_code) WHERE teaching_code IS NOT NULL;

UPDATE subjects s SET teaching_code = v.teaching_code, updated_at = now()
FROM (VALUES
    ('TOAN', '01'), ('NGUVAN', '02'), ('NGOAINGU', '03'), ('VATLI', '04'), ('HOAHOC', '05'),
    ('SINHHOC', '06'), ('LICHSU', '07'), ('DIALI', '08'), ('GDKTPL', '09'), ('TINHOC', '10'),
    ('CONGNGHE', '11'), ('AMNHAC', '12'), ('MITHUAT', '13'), ('GDTC', '14'), ('GDQPAN', '15'),
    ('HDTN', '16'), ('DUNGCHUNG', '00')
) AS v(code, teaching_code)
WHERE s.code = v.code AND s.teaching_code IS NULL;
--rollback DROP INDEX uq_subjects_teaching_code; ALTER TABLE subjects DROP CONSTRAINT ck_subjects_teaching_code; ALTER TABLE subjects DROP COLUMN teaching_code;
