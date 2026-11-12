--liquibase formatted sql

--changeset luudong:015-anh-dai-dien-vung-cat
--comment Tệp đính kèm: cách đóng khung vuông của ảnh đại diện (cover_crop = "x,y,zoom", x/y là tâm theo %,
--comment zoom >= 1). Ảnh gốc giữ nguyên, chỉ lưu cách cắt. Cột is_cover và chỉ mục một-ảnh-đại-diện đã có ở 011.
ALTER TABLE attachments ADD COLUMN cover_crop VARCHAR(100);
--rollback ALTER TABLE attachments DROP COLUMN cover_crop;
