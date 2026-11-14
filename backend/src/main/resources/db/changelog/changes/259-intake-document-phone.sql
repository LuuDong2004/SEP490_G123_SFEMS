--liquibase formatted sql

-- Hoá đơn của phiếu ghi tăng ghi SỐ ĐIỆN THOẠI nhà cung cấp thay cho mã số thuế trên form (trưởng nhóm 14/11/2026):
-- trường cần số để liên hệ khi hàng có vấn đề. Mã số thuế vẫn giữ (đọc từ hoá đơn điện tử, dùng kiểm hoá đơn trùng),
-- chỉ không còn là ô nhập.

--changeset luudong:259-intake-document-phone
ALTER TABLE equipment_intake_documents ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
--rollback ALTER TABLE equipment_intake_documents DROP COLUMN phone;
