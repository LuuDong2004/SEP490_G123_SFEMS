--liquibase formatted sql

--changeset luudong:294-bo-ai-lam-sach-du-lieu
--comment Bỏ chức năng AI gợi ý sửa dữ liệu nhập. Chuẩn hoá dữ liệu còn Sửa nhanh theo luật trong code (OnboardingQuickFix)
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'ai_settings:%');
DELETE FROM permissions WHERE code LIKE 'ai_settings:%';
-- Ô từng nhận gợi ý của AI: người dùng đã xem và bấm áp dụng, ghi là sửa tay.
ALTER TABLE data_import_edits DROP CONSTRAINT ck_data_import_edits_source;
UPDATE data_import_edits SET source = 'manual' WHERE source = 'ai';
ALTER TABLE data_import_edits ADD CONSTRAINT ck_data_import_edits_source CHECK (source IN ('manual', 'rule'));
UPDATE data_import_rows SET edit_source = 'manual' WHERE edit_source = 'ai';
DROP TABLE ai_calls;
DROP TABLE ai_settings;
--rollback empty
