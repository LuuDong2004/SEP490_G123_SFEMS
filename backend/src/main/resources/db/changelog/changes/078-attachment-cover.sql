--liquibase formatted sql

--changeset qltb:078-attachment-cover
--comment Ảnh ĐẠI DIỆN của một bản ghi (vd. thiết bị): một tệp ảnh được đánh dấu is_cover, kèm vùng cắt khung vuông (cover_crop = "x,y,zoom", x/y là tâm theo %, zoom >= 1) — giữ nguyên ảnh gốc, chỉ lưu cách đóng khung. Mỗi bản ghi tối đa một ảnh đại diện (chỉ mục duy nhất có điều kiện).
ALTER TABLE attachments ADD COLUMN is_cover BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE attachments ADD COLUMN cover_crop VARCHAR(100);
CREATE UNIQUE INDEX ux_attachments_one_cover ON attachments (resource, record_id) WHERE is_cover;
--rollback DROP INDEX ux_attachments_one_cover; ALTER TABLE attachments DROP COLUMN cover_crop; ALTER TABLE attachments DROP COLUMN is_cover;
