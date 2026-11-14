--liquibase formatted sql

-- Thiết bị NGOÀI DANH MỤC của Sở: đồ tự làm, được tài trợ, mua ngoài danh mục. Trường tự thêm
-- ngay lúc ghi tăng thay vì chờ Sở bổ sung; chỉ trường đó chọn được nó.
--
-- owner_school_id NULL = danh mục của Sở (mọi trường dùng). Có giá trị = thiết bị riêng của
-- trường ấy, và khi đó BẮT BUỘC khai nguồn gốc — báo cáo của Sở cộng thiết bị ngoài danh mục
-- theo loại / môn / phân loại như mọi thiết bị khác, nguồn gốc là thứ tách riêng được chúng.

--changeset qltb:087-school-owned-equipment-catalogs
ALTER TABLE equipment_catalogs ADD COLUMN owner_school_id BIGINT;
ALTER TABLE equipment_catalogs ADD COLUMN origin VARCHAR(30);
ALTER TABLE equipment_catalogs
    ADD CONSTRAINT fk_equipment_catalogs_owner_school FOREIGN KEY (owner_school_id)
        REFERENCES schools (id) ON DELETE RESTRICT;
ALTER TABLE equipment_catalogs
    ADD CONSTRAINT ck_equipment_catalogs_origin
        CHECK (origin IS NULL OR origin IN ('SELF_MADE', 'DONATED', 'OUTSIDE_PURCHASE'));
ALTER TABLE equipment_catalogs
    ADD CONSTRAINT ck_equipment_catalogs_owner_origin CHECK (owner_school_id IS NULL OR origin IS NOT NULL);
CREATE INDEX ix_equipment_catalogs_owner_school ON equipment_catalogs (owner_school_id);
--rollback DROP INDEX ix_equipment_catalogs_owner_school; ALTER TABLE equipment_catalogs DROP CONSTRAINT ck_equipment_catalogs_owner_origin; ALTER TABLE equipment_catalogs DROP CONSTRAINT ck_equipment_catalogs_origin; ALTER TABLE equipment_catalogs DROP CONSTRAINT fk_equipment_catalogs_owner_school; ALTER TABLE equipment_catalogs DROP COLUMN origin; ALTER TABLE equipment_catalogs DROP COLUMN owner_school_id;
