--liquibase formatted sql

--changeset qltb:240-drop-csvc-confirmation
-- Bỏ cơ chế lãnh đạo XÁC NHẬN hiện trạng CSVC của 202 (QLTB-639..641) — trưởng nhóm chốt 12/11/2026: cán bộ thiết bị
-- của trường có toàn quyền, khai / sửa phòng, hạng mục, khối nhà là chính thức luôn, không chờ ai duyệt. Giữ nguyên các
-- cột confirm_* / return_reason (schema ổn định, ứng dụng không còn đọc ghi chúng); chỉ đưa mọi bản đang chờ / bị trả
-- lại về chính thức và thu hồi hai mã quyền xác nhận.
UPDATE rooms SET confirm_status = 'CONFIRMED', return_reason = NULL
WHERE confirm_status <> 'CONFIRMED' OR return_reason IS NOT NULL;
UPDATE buildings SET confirm_status = 'CONFIRMED', return_reason = NULL
WHERE confirm_status <> 'CONFIRMED' OR return_reason IS NOT NULL;

DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('rooms:approve', 'buildings:approve'));
DELETE FROM permissions WHERE code IN ('rooms:approve', 'buildings:approve');
--rollback INSERT INTO permissions (code, name, description, system_permission) VALUES ('rooms:approve', 'Xác nhận phòng, hạng mục CSVC', 'Xác nhận hoặc trả lại hiện trạng phòng, hạng mục CSVC đã khai', TRUE), ('buildings:approve', 'Xác nhận khối nhà', 'Xác nhận hoặc trả lại hiện trạng khối nhà đã khai', TRUE);
