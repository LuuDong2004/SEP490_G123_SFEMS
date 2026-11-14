--liquibase formatted sql

--changeset qltb:249-demo-accounts-linked-staff
-- DỮ LIỆU DEMO (trưởng nhóm 13/11/2026): tài khoản demo của trường ("Cán bộ thiết bị THCS Bình An (demo)") và hồ sơ cán
-- bộ cùng chức vụ (Lê Thị Thu — Cán bộ thiết bị) là HAI người trên hệ thống, trong khi thực tế là một: tài khoản không
-- nối hồ sơ nên phiếu không biết người lập là ai trong danh sách cán bộ (ô Người nhận của phiếu ghi tăng điền tên tài
-- khoản, chức vụ "Chưa xác định"). Nối mỗi tài khoản demo với cán bộ ĐẦU TIÊN (theo mã) đúng chức vụ ở đúng trường —
-- `*.canbo` ↔ Cán bộ thiết bị, `*.hieutruong` ↔ Hiệu trưởng — rồi lấy họ tên hồ sơ làm họ tên tài khoản.
-- Chỉ nối khi cả hai bên còn trống (tài khoản chưa nối cán bộ nào, cán bộ chưa có tài khoản); không có cán bộ đúng chức
-- vụ thì bỏ qua. Không đụng trường thật.
WITH pairs (username, school_code, position) AS (
    VALUES ('thcs.canbo', 'THCSBINHANQ2', 'CAN_BO_THIET_BI'),
           ('thcs.hieutruong', 'THCSBINHANQ2', 'HIEU_TRUONG'),
           ('thcs2.canbo', 'THCSDANGTANTAI', 'CAN_BO_THIET_BI'),
           ('thcs2.hieutruong', 'THCSDANGTANTAI', 'HIEU_TRUONG'),
           ('thpt.canbo', 'THPTANLAC', 'CAN_BO_THIET_BI'),
           ('thpt.hieutruong', 'THPTANLAC', 'HIEU_TRUONG')
), picked AS (
    SELECT DISTINCT ON (p.username) u.id AS user_id, st.id AS staff_id
    FROM pairs p
    JOIN users u ON u.username = p.username
    JOIN schools sc ON sc.code = p.school_code
    JOIN staff st ON st.school_id = sc.id AND st.position = p.position AND st.user_id IS NULL
    WHERE NOT EXISTS (SELECT 1 FROM staff x WHERE x.user_id = u.id)
    ORDER BY p.username, st.code
)
UPDATE staff s SET user_id = picked.user_id FROM picked WHERE s.id = picked.staff_id;

UPDATE users u
SET full_name = st.name
FROM staff st
WHERE st.user_id = u.id
  AND u.username IN ('thcs.canbo', 'thcs.hieutruong', 'thcs2.canbo', 'thcs2.hieutruong', 'thpt.canbo', 'thpt.hieutruong');

--rollback UPDATE staff SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE username IN ('thcs.canbo', 'thcs.hieutruong', 'thcs2.canbo', 'thcs2.hieutruong', 'thpt.canbo', 'thpt.hieutruong'));
