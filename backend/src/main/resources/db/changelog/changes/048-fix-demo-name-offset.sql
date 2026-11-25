--liquibase formatted sql

--changeset dth:048-fix-demo-name-offset
--comment Trả lại chữ T bị 047 cắt lố: "rường Tiểu học..." -> "Trường Tiểu học...".

-- Migration 047 cắt tiền tố "[DEMO] " bằng `substring(name FROM 9)`. Tiền tố
-- ấy dài ĐÚNG 7 ký tự — dấu [, D, E, M, O, ] và một dấu cách — nên ký tự đầu
-- của phần còn lại nằm ở vị trí 8, không phải 9. Lệch một, và cái lệch ấy ăn
-- mất chữ "T" của "Trường".
--
-- Không sửa 047 tại chỗ: nó đã chạy nên đổi nội dung sẽ làm checksum của
-- Liquibase lệch và chặn khởi động ở mọi cơ sở dữ liệu đã áp nó. Một migration
-- mới thì đúng ở cả hai đường: cơ sở dữ liệu đã áp 047 được vá, còn cơ sở dữ
-- liệu mới chạy 046 → 047 → 048 và ra cùng một kết quả.
UPDATE schools
SET name = 'T' || name
WHERE code LIKE 'DEMO-%'
  AND name LIKE 'rường %';
