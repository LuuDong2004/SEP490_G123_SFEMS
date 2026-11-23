--liquibase formatted sql

--changeset qltb:137-destruction-label-spelling
-- Lịch sử tài sản lưu NHÃN trạng thái dạng chữ. 136 ghi "tiêu hủy", còn ứng dụng viết "tiêu huỷ" ở mọi
-- chỗ khác; đổi các dòng đã ghi để lịch sử cũ và mới cùng một cách viết.
UPDATE equipment_history SET to_value = REPLACE(to_value, 'tiêu hủy', 'tiêu huỷ')
WHERE field = 'status' AND to_value IN ('Chờ tiêu hủy', 'Đã tiêu hủy');

UPDATE equipment_history SET from_value = REPLACE(from_value, 'tiêu hủy', 'tiêu huỷ')
WHERE field = 'status' AND from_value IN ('Chờ tiêu hủy', 'Đã tiêu hủy');

--rollback UPDATE equipment_history SET to_value = REPLACE(to_value, 'tiêu huỷ', 'tiêu hủy') WHERE field = 'status' AND to_value IN ('Chờ tiêu huỷ', 'Đã tiêu huỷ');
--rollback UPDATE equipment_history SET from_value = REPLACE(from_value, 'tiêu huỷ', 'tiêu hủy') WHERE field = 'status' AND from_value IN ('Chờ tiêu huỷ', 'Đã tiêu huỷ');
