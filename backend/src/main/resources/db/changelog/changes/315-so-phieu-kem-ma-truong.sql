--liquibase formatted sql

--changeset luudong:315-so-phieu-kem-ma-truong
--comment Số phiếu kèm mã trường: <tiền tố>-<mã trường>-<2 số của năm>-<4 số> (MS-79000786-26-0001). Mỗi trường đếm từ 1 nên số cũ trùng nhau giữa các trường (màn của Sở thấy ba phiếu "MS-2026-00001"). Đổi số đã cấp của đề xuất, phiếu ghi tăng, phiếu kiểm kê; số phiếu nguồn chép trên phiếu ghi tăng đổi theo. Thêm chỉ mục duy nhất toàn bảng để không bao giờ trùng nữa.
UPDATE purchase_proposals p SET code = split_part(p.code, '-', 1) || '-' || s.code || '-' || right(split_part(p.code, '-', 2), 2) || '-' || lpad(ltrim(split_part(p.code, '-', 3), '0'), 4, '0')
FROM schools s WHERE s.id = p.school_id AND p.code ~ '^[A-Z]+-[0-9]{4}-[0-9]+$';
UPDATE equipment_intakes p SET code = split_part(p.code, '-', 1) || '-' || s.code || '-' || right(split_part(p.code, '-', 2), 2) || '-' || lpad(ltrim(split_part(p.code, '-', 3), '0'), 4, '0')
FROM schools s WHERE s.id = p.school_id AND p.code ~ '^[A-Z]+-[0-9]{4}-[0-9]+$';
UPDATE inventory_sessions p SET code = split_part(p.code, '-', 1) || '-' || s.code || '-' || right(split_part(p.code, '-', 2), 2) || '-' || lpad(ltrim(split_part(p.code, '-', 3), '0'), 4, '0')
FROM schools s WHERE s.id = p.school_id AND p.code ~ '^[A-Z]+-[0-9]{4}-[0-9]+$';
UPDATE equipment_intakes i SET source_code = p.code FROM purchase_proposals p
WHERE i.source_resource = 'purchase_proposals' AND i.source_id = p.id AND p.code IS NOT NULL;
UPDATE equipment_intakes i SET source_code = k.code FROM inventory_sessions k
WHERE i.source_resource = 'inventory_sessions' AND i.source_id = k.id AND k.code IS NOT NULL;
CREATE UNIQUE INDEX uq_purchase_proposals_code ON purchase_proposals (code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX uq_equipment_intakes_code ON equipment_intakes (code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX uq_inventory_sessions_code ON inventory_sessions (code) WHERE code IS NOT NULL;
--rollback DROP INDEX uq_purchase_proposals_code; DROP INDEX uq_equipment_intakes_code; DROP INDEX uq_inventory_sessions_code;
--rollback UPDATE purchase_proposals SET code = split_part(code, '-', 1) || '-20' || split_part(code, '-', 3) || '-' || lpad(split_part(code, '-', 4), 5, '0') WHERE code ~ '^[A-Z]+-[0-9A-Z]+-[0-9]{2}-[0-9]+$';
--rollback UPDATE equipment_intakes SET code = split_part(code, '-', 1) || '-20' || split_part(code, '-', 3) || '-' || lpad(split_part(code, '-', 4), 5, '0') WHERE code ~ '^[A-Z]+-[0-9A-Z]+-[0-9]{2}-[0-9]+$';
--rollback UPDATE inventory_sessions SET code = split_part(code, '-', 1) || '-20' || split_part(code, '-', 3) || '-' || lpad(split_part(code, '-', 4), 5, '0') WHERE code ~ '^[A-Z]+-[0-9A-Z]+-[0-9]{2}-[0-9]+$';
