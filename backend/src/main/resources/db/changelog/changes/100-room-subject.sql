--liquibase formatted sql

-- Phòng bộ môn là của MÔN nào.
--
-- Danh mục thiết bị dạy học tối thiểu có 329 dòng "tính cho 01 phòng học bộ môn" (KHTN, Công nghệ,
-- Tin học, Mĩ thuật, Ngoại ngữ…). Muốn tính chuẩn của MỘT trường thì phải biết trường có mấy phòng
-- của môn đó — phòng trước đây chỉ có loại (phòng bộ môn / thí nghiệm / máy tính), không có môn, nên
-- mọi trường đều bị tính như có đúng một phòng.
--
-- Cột cho NULL: phòng học thường, kho, thư viện không thuộc môn nào.

--changeset qltb:100-room-subject
ALTER TABLE rooms ADD COLUMN subject_id BIGINT;
ALTER TABLE rooms
    ADD CONSTRAINT fk_rooms_subject FOREIGN KEY (subject_id) REFERENCES subjects (id);
CREATE INDEX idx_rooms_subject ON rooms (subject_id);

-- Phòng đã có: đoán môn theo TÊN phòng, chỉ với ba loại phòng dành cho một môn. Đoán sai thì trường
-- sửa lại trên form Phòng; không đoán được thì để trống (phòng đó chưa được tính vào định mức theo phòng).
--changeset qltb:100-room-subject-backfill
UPDATE rooms r
SET subject_id = (SELECT id FROM subjects WHERE code = m.subject_code)
FROM room_types t,
     (VALUES ('%máy tính%', 'TIN_HOC'),
             ('%tin học%', 'TIN_HOC'),
             ('%công nghệ%', 'CONG_NGHE'),
             ('%mỹ thuật%', 'MY_THUAT'),
             ('%mĩ thuật%', 'MY_THUAT'),
             ('%âm nhạc%', 'AM_NHAC'),
             ('%ngoại ngữ%', 'TIENG_ANH'),
             ('%tiếng anh%', 'TIENG_ANH'),
             ('%vật lý%', 'VAT_LY'),
             ('%vật lí%', 'VAT_LY'),
             ('%hóa%', 'HOA_HOC'),
             ('%hoá%', 'HOA_HOC'),
             ('%sinh%', 'SINH_HOC'),
             ('%khoa học tự nhiên%', 'KHTN'),
             ('%khtn%', 'KHTN')) AS m (pattern, subject_code)
WHERE t.id = r.room_type_id
  AND t.code IN ('PHONG_BO_MON', 'PHONG_THI_NGHIEM', 'PHONG_MAY')
  AND r.subject_id IS NULL
  AND lower(r.name) LIKE m.pattern;

-- "Phòng thí nghiệm" không ghi môn ở trường THCS là phòng thực hành Khoa học tự nhiên.
UPDATE rooms r
SET subject_id = (SELECT id FROM subjects WHERE code = 'KHTN')
FROM room_types t, schools s, education_levels lv
WHERE t.id = r.room_type_id AND t.code = 'PHONG_THI_NGHIEM'
  AND s.id = r.school_id AND lv.id = s.education_level_id AND lv.code = 'THCS'
  AND r.subject_id IS NULL;
