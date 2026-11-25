--liquibase formatted sql

--changeset qltb:242-drop-room-type-params
-- Bỏ toàn bộ thông số riêng theo loại CSVC do 201 thêm (thư viện: kho sách kín / mở, phòng đọc; nhà để xe; nhà đa năng:
-- sàn tập, chiều cao thông thủy; sân: kích thước; nhà nội trú: số chỗ ngủ…) — trưởng nhóm chốt 12/11/2026: không báo cáo,
-- không phép chấm chuẩn nào dùng, chỉ thêm ô phải khai. Cùng hướng với 241 (forGrades). Cột `params` giữ nguyên (rỗng):
-- loại nào để trống thì form và màn xem phòng không hiện ô / khối "Thông số".
UPDATE room_types SET params = '[]'::jsonb WHERE params IS NOT NULL AND params <> '[]'::jsonb;
UPDATE rooms SET params = '{}'::jsonb WHERE params IS NOT NULL AND params <> '{}'::jsonb;
--rollback SELECT 1;
