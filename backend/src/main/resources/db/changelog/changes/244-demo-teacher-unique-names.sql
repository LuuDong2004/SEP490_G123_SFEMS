--liquibase formatted sql

--changeset qltb:244-demo-teacher-unique-names
-- DỮ LIỆU DEMO (M2-16, 13/11/2026): bộ sinh tên của 101 cho nhiều giáo viên KHÁC nhau cùng một họ tên (THCS Bình An có
-- ba "Bùi Minh Uyên" ở ba môn) — trông như một người bị nhân bản. Đặt lại tên giáo viên mẫu (`GV-…`) của ba trường
-- demo sao cho trong một trường không ai trùng: thứ tự `rn` theo mã, họ = rn mod 12, tên = rn mod 16 — cặp (họ, tên)
-- khác nhau với mọi rn < 48 (bội chung nhỏ nhất của 12 và 16), đủ cho trường đông nhất (THPT An Lạc, 46 giáo viên).
-- Không đụng cán bộ (CB…) hay trường thật.
UPDATE staff s
SET name = (ARRAY['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ'])[1 + (n.rn % 12)]
           || ' ' || (ARRAY['Thị', 'Văn', 'Minh', 'Ngọc', 'Thanh', 'Quốc', 'Thu', 'Hữu'])[1 + (n.rn % 8)]
           || ' ' || (ARRAY['An', 'Bình', 'Châu', 'Dung', 'Giang', 'Hà', 'Khoa', 'Lan', 'Mai', 'Nam', 'Phúc', 'Quyên',
                            'Sơn', 'Tâm', 'Uyên', 'Vy'])[1 + (n.rn % 16)]
FROM (SELECT st.id, (row_number() OVER (PARTITION BY st.school_id ORDER BY st.code) - 1)::int AS rn
      FROM staff st
      JOIN schools sc ON sc.id = st.school_id
      WHERE sc.code IN ('THCSBINHANQ2', 'THCSDANGTANTAI', 'THPTANLAC') AND st.code LIKE 'GV-%') n
WHERE s.id = n.id;

--rollback -- dữ liệu demo, không cần lùi tên.
