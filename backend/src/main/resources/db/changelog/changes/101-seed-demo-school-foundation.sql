--liquibase formatted sql

-- DỮ LIỆU DEMO: dữ liệu nền của ba trường mẫu (THCS Bình An, THCS Đặng Tấn Tài, THPT An Lạc) để
-- chuẩn thiết bị tối thiểu của TỪNG TRƯỜNG tính ra được số — lớp học kèm sĩ số của năm học hiện
-- hành, và giáo viên theo môn. Không đụng trường nào khác.
--
-- Chạy lại an toàn: lớp chỉ thêm khi trường CHƯA có lớp nào của năm học hiện hành; giáo viên thêm
-- theo mã `GV-<môn>-<n>` với ON CONFLICT DO NOTHING.
--
-- THCS Đặng Tấn Tài cố ý KHÔNG có giáo viên Âm nhạc và Mĩ thuật: màn "Thiết bị tối thiểu của
-- trường" cần một trường còn thiếu dữ liệu nền để thấy dòng "chưa tính được".

--changeset qltb:101-demo-classes
INSERT INTO school_classes (school_id, code, name, active, grade_id, school_year_id, student_count, created_at)
SELECT s.id,
       g.n || 'A' || k,
       g.n || 'A' || k,
       TRUE,
       gr.id,
       y.id,
       38 + ((g.n * 7 + k * 3) % 8),
       now()
FROM (VALUES ('THCSDANGTANTAI', 6, 5), ('THCSDANGTANTAI', 7, 5), ('THCSDANGTANTAI', 8, 5), ('THCSDANGTANTAI', 9, 5),
             ('THPTANLAC', 10, 10), ('THPTANLAC', 11, 10), ('THPTANLAC', 12, 10),
             ('THCSBINHANQ2', 6, 6), ('THCSBINHANQ2', 7, 6), ('THCSBINHANQ2', 8, 6), ('THCSBINHANQ2', 9, 6))
         AS g (school_code, n, classes)
JOIN schools s ON s.code = g.school_code
JOIN grades gr ON gr.code = 'LOP_' || g.n
JOIN school_years y ON y.is_current
CROSS JOIN LATERAL generate_series(1, g.classes) AS k
WHERE NOT EXISTS (
    SELECT 1 FROM school_classes c WHERE c.school_id = s.id AND c.school_year_id = y.id);

--changeset qltb:101-demo-teachers
INSERT INTO staff (school_id, code, name, active, staff_type, position, department, main_subject_id, created_at)
SELECT s.id,
       'GV-' || replace(t.subject_code, '_', '') || '-' || k,
       (ARRAY['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ'])
           [1 + ((t.ord * 5 + k * 3 + length(s.code)) % 12)]
       || ' ' ||
       (ARRAY['Thị', 'Văn', 'Minh', 'Ngọc', 'Thanh', 'Quốc', 'Thu', 'Hữu'])[1 + ((t.ord * 3 + k) % 8)]
       || ' ' ||
       (ARRAY['An', 'Bình', 'Châu', 'Dung', 'Giang', 'Hà', 'Khoa', 'Lan', 'Mai', 'Nam', 'Phúc', 'Quyên', 'Sơn',
              'Tâm', 'Uyên', 'Vy'])[1 + ((t.ord * 7 + k * 5 + length(s.name)) % 16)],
       TRUE,
       'TEACHER',
       'GIAO_VIEN',
       t.team,
       sj.id,
       now()
FROM (VALUES
          -- THCS: môn theo danh mục tối thiểu cấp THCS (Lịch sử và Địa lí là hai phân môn riêng).
          ('THCS', 'TOAN', 4, 'Tổ Toán - Tin', 1),
          ('THCS', 'NGU_VAN', 4, 'Tổ Ngữ văn', 2),
          ('THCS', 'TIENG_ANH', 3, 'Tổ Ngoại ngữ', 3),
          ('THCS', 'KHTN', 5, 'Tổ Khoa học tự nhiên', 4),
          ('THCS', 'LICH_SU', 2, 'Tổ Xã hội', 5),
          ('THCS', 'DIA_LY', 2, 'Tổ Xã hội', 6),
          ('THCS', 'GDCD', 1, 'Tổ Xã hội', 7),
          ('THCS', 'CONG_NGHE', 2, 'Tổ Khoa học tự nhiên', 8),
          ('THCS', 'TIN_HOC', 2, 'Tổ Toán - Tin', 9),
          ('THCS', 'THE_DUC', 2, 'Tổ Năng khiếu', 10),
          ('THCS', 'AM_NHAC', 1, 'Tổ Năng khiếu', 11),
          ('THCS', 'MY_THUAT', 1, 'Tổ Năng khiếu', 12),
          ('THCS', 'HD_TRAI_NGHIEM', 1, 'Tổ Xã hội', 13),
          ('THPT', 'TOAN', 6, 'Tổ Toán', 1),
          ('THPT', 'NGU_VAN', 5, 'Tổ Ngữ văn', 2),
          ('THPT', 'TIENG_ANH', 5, 'Tổ Ngoại ngữ', 3),
          ('THPT', 'VAT_LY', 4, 'Tổ Vật lý - Công nghệ', 4),
          ('THPT', 'HOA_HOC', 4, 'Tổ Hoá học', 5),
          ('THPT', 'SINH_HOC', 3, 'Tổ Sinh học', 6),
          ('THPT', 'LICH_SU', 3, 'Tổ Xã hội', 7),
          ('THPT', 'DIA_LY', 3, 'Tổ Xã hội', 8),
          ('THPT', 'GDKT_PL', 2, 'Tổ Xã hội', 9),
          ('THPT', 'CONG_NGHE', 2, 'Tổ Vật lý - Công nghệ', 10),
          ('THPT', 'TIN_HOC', 3, 'Tổ Tin học', 11),
          ('THPT', 'THE_DUC', 3, 'Tổ Giáo dục thể chất', 12),
          ('THPT', 'AM_NHAC', 1, 'Tổ Nghệ thuật', 13),
          ('THPT', 'MY_THUAT', 1, 'Tổ Nghệ thuật', 14),
          ('THPT', 'HD_TRAI_NGHIEM', 1, 'Tổ Xã hội', 15))
         AS t (level_code, subject_code, teachers, team, ord)
JOIN education_levels lv ON lv.code = t.level_code
JOIN schools s ON s.education_level_id = lv.id
              AND s.code IN ('THCSBINHANQ2', 'THCSDANGTANTAI', 'THPTANLAC')
JOIN subjects sj ON sj.code = t.subject_code
CROSS JOIN LATERAL generate_series(1, t.teachers) AS k
WHERE NOT (s.code = 'THCSDANGTANTAI' AND t.subject_code IN ('AM_NHAC', 'MY_THUAT'))
ON CONFLICT (school_id, code) DO NOTHING;

-- Trường THPT: phòng thí nghiệm chung chưa gắn môn — thêm phòng bộ môn Tin học thứ hai cho An Lạc để
-- thấy định mức theo phòng nhân lên (30 lớp, hai phòng máy).
--changeset qltb:101-demo-second-computer-room
INSERT INTO rooms (school_id, code, name, active, room_type_id, subject_id, created_at)
SELECT s.id, 'PM-02', 'Phòng máy tính 2', TRUE, t.id, sj.id, now()
FROM schools s
JOIN room_types t ON t.code = 'PHONG_MAY'
JOIN subjects sj ON sj.code = 'TIN_HOC'
WHERE s.code = 'THPTANLAC'
ON CONFLICT (school_id, code) DO NOTHING;
