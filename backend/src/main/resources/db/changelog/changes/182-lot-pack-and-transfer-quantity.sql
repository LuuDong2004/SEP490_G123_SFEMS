--liquibase formatted sql

-- Quy cách bao bì đi theo LÔ, không chỉ nằm trên dòng phiếu ghi tăng (QLTB-501 nối tiếp): lô "100 ml" biết nó là
-- "10 lọ × 10 ml", nên cấp phát / điều chuyển / tiêu hao nhập được "3 lọ" và tự quy ra 30 ml. Lô tách ra (cấp
-- phát, điều chuyển một phần) mang theo quy cách của lô gốc. Lô cũ: chép từ dòng phiếu ghi tăng đã sinh ra nó.
--changeset qltb:182-lot-pack
ALTER TABLE equipment
    ADD COLUMN pack_unit_id BIGINT REFERENCES units (id),
    ADD COLUMN pack_size NUMERIC(14, 3),
    ADD CONSTRAINT ck_equipment_pack CHECK ((pack_unit_id IS NULL) = (pack_size IS NULL));
UPDATE equipment e
SET pack_unit_id = l.pack_unit_id, pack_size = l.pack_size
FROM equipment_intake_lines l
WHERE l.id = e.intake_line_id AND l.pack_unit_id IS NOT NULL AND l.pack_size IS NOT NULL;
--rollback ALTER TABLE equipment DROP CONSTRAINT ck_equipment_pack, DROP COLUMN pack_size, DROP COLUMN pack_unit_id;

-- Điều chuyển liên trường một PHẦN lô vật tư / hoá chất — như dòng cấp phát (132): số lượng chuyển, và lô tách ra
-- lúc duyệt (phần chuyển đi, "Đang điều chuyển"); trống = chuyển cả lô / tài sản quản lý từng cái.
--changeset qltb:182-transfer-line-quantity
ALTER TABLE equipment_transfer_lines
    ADD COLUMN quantity NUMERIC(14, 3),
    ADD COLUMN transferred_equipment_id BIGINT REFERENCES equipment (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ix_equipment_transfer_lines_transferred
    ON equipment_transfer_lines (transferred_equipment_id) WHERE transferred_equipment_id IS NOT NULL;
--rollback DROP INDEX IF EXISTS ix_equipment_transfer_lines_transferred;
--rollback ALTER TABLE equipment_transfer_lines DROP COLUMN transferred_equipment_id, DROP COLUMN quantity;
