--liquibase formatted sql

--changeset luudong:016-phieu-nhap-han-dung-quy-cach
--comment Phiếu nhập (PN-01): hạn sử dụng của lô vật tư, hoá chất và quy cách bao bì ở từng dòng; tài sản sinh ra mang hạn sử dụng.

-- ---------------------------------------------------------------- 1. Dòng phiếu nhập
-- Hạn sử dụng chỉ có ở dòng quản lý theo số lượng; hoá chất bắt buộc có khi trình.
-- Quy cách: 1 pack_unit = pack_size đơn vị của thiết bị. Có quy cách thì số lượng của dòng đếm theo bao bì,
-- đơn giá là giá một bao bì, và lô vào sổ mang số lượng đã quy đổi.
ALTER TABLE equipment_intake_lines
    ADD COLUMN expiry_date  DATE,
    ADD COLUMN pack_unit_id BIGINT REFERENCES units (id) ON DELETE RESTRICT,
    ADD COLUMN pack_size    NUMERIC(14, 3),
    ADD CONSTRAINT ck_equipment_intake_lines_pack CHECK (
        (pack_unit_id IS NULL AND pack_size IS NULL) OR (pack_unit_id IS NOT NULL AND pack_size > 0));
CREATE INDEX ix_equipment_intake_lines_pack_unit ON equipment_intake_lines (pack_unit_id);

-- ---------------------------------------------------------------- 2. Hồ sơ tài sản
-- Lô hoá chất, vật tư tiêu hao có hạn sử dụng: màn Thiết bị đọc cột này để báo lô sắp / đã hết hạn.
ALTER TABLE equipment
    ADD COLUMN expiry_date DATE;

--rollback ALTER TABLE equipment DROP COLUMN expiry_date; DROP INDEX ix_equipment_intake_lines_pack_unit; ALTER TABLE equipment_intake_lines DROP CONSTRAINT ck_equipment_intake_lines_pack, DROP COLUMN pack_size, DROP COLUMN pack_unit_id, DROP COLUMN expiry_date;
