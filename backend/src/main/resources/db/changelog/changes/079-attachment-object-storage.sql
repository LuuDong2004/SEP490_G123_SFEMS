--liquibase formatted sql

--changeset qltb:079-attachment-object-storage
-- Nội dung tệp chuyển sang MinIO: dòng giữ khoá đối tượng. `data` còn lại cho các dòng
-- chưa chuyển — AttachmentStorageMigrator chuyển chúng lúc khởi động rồi đặt NULL.
ALTER TABLE attachments ADD COLUMN storage_key VARCHAR(300);
ALTER TABLE attachments ALTER COLUMN data DROP NOT NULL;
ALTER TABLE attachments ADD CONSTRAINT ck_attachments_content
    CHECK (storage_key IS NOT NULL OR data IS NOT NULL);
