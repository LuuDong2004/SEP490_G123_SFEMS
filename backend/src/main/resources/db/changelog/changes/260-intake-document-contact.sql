--liquibase formatted sql

-- Ô liên hệ của hoá đơn nhận SỐ ĐIỆN THOẠI HOẶC EMAIL của nhà cung cấp (trưởng nhóm 14/11/2026), không chỉ số điện
-- thoại như 256: đổi tên cột thành contact, nới tới độ dài email.

--changeset luudong:260-intake-document-contact
ALTER TABLE equipment_intake_documents RENAME COLUMN phone TO contact;
ALTER TABLE equipment_intake_documents ALTER COLUMN contact TYPE VARCHAR(254);
--rollback ALTER TABLE equipment_intake_documents ALTER COLUMN contact TYPE VARCHAR(20); ALTER TABLE equipment_intake_documents RENAME COLUMN contact TO phone;
