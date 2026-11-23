--liquibase formatted sql

--changeset dth:047-demo-school-names
--comment Bỏ tiền tố [DEMO] khỏi tên trường demo — dấu hiệu đã nằm ở mã.

-- Migration 046 đặt tên dạng "[DEMO] Trường Tiểu học số 1 - Phường Thủ Dầu Một".
-- Tiền tố ấy có lý do: dữ liệu demo phải trông ra là demo. Nhưng nó đặt sai
-- chỗ.
--
-- Tên trường là thứ hiện ở MỌI nơi — cây tổng quan, ô chọn, bảng, biên bản in
-- — và ở những chỗ hẹp thì mười ký tự tiền tố đẩy phần có nghĩa ra khỏi khung:
-- trên cây tổng quan, "[DEMO] Trường Tiểu học số 10..." là tất cả những gì đọc
-- được, tức là không phân biệt được trường nào với trường nào.
--
-- Dấu hiệu demo vẫn còn, và còn ở chỗ bền hơn:
--   · `code` bắt đầu bằng DEMO- (đây cũng là thứ câu lệnh xoá dùng)
--   · `moet_code` rỗng — không có mã định danh Bộ GD&ĐT
--   · cơ quan chủ quản mang mã DEMO-UBND-
--
-- Xoá toàn bộ dữ liệu demo vẫn là:
--   DELETE FROM schools WHERE code LIKE 'DEMO-%';
--   DELETE FROM departments_of_education WHERE code LIKE 'DEMO-UBND-%';
UPDATE schools
SET name = substring(name FROM 9)
WHERE code LIKE 'DEMO-%'
  AND name LIKE '[DEMO] %';
