--liquibase formatted sql

-- Model và Hãng sản xuất là thuộc tính của TỪNG TÀI SẢN (theo lô mua), không phải của nhóm
-- thiết bị trong danh mục: cùng một nhóm nhưng mỗi lần mua có thể là hãng/model khác nhau.
-- Người lập phiếu khai ở DÒNG phiếu ghi tăng; xác nhận phiếu thì giá trị chạy xuống tài sản.
--
-- Cột trên equipment_catalogs giữ nguyên (dữ liệu cũ còn tra được), chỉ ẩn khỏi giao diện.
-- Giá trị đã khai trên nhóm được đổ xuống các tài sản hiện có chưa có dữ liệu riêng.

--changeset qltb:112-asset-model-manufacturer
ALTER TABLE equipment_intake_lines ADD COLUMN model VARCHAR(255);
ALTER TABLE equipment_intake_lines ADD COLUMN manufacturer VARCHAR(255);
ALTER TABLE equipment ADD COLUMN model VARCHAR(255);
ALTER TABLE equipment ADD COLUMN manufacturer VARCHAR(255);

UPDATE equipment e SET model = c.model, updated_at = now()
FROM equipment_catalogs c
WHERE e.catalog_id = c.id AND e.model IS NULL AND c.model IS NOT NULL;

UPDATE equipment e SET manufacturer = c.manufacturer, updated_at = now()
FROM equipment_catalogs c
WHERE e.catalog_id = c.id AND e.manufacturer IS NULL AND c.manufacturer IS NOT NULL;
