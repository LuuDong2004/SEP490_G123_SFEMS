--liquibase formatted sql

-- Số lượng LẺ chỉ cho đơn vị tính CHIA ĐƯỢC (kg, g, lít, ml, mét): dùng 0,2 kg NaOH hay 250 ml
-- HCl là chuyện hằng ngày của phòng thí nghiệm, còn 0,5 cái máy tính thì vô nghĩa. Cờ nằm ở
-- đơn vị tính (units.allows_fraction); số lượng trên bản ghi thiết bị, dòng xuất kho, phiếu ghi
-- tiêu hao thành NUMERIC(14,3). Máy chủ từ chối số lẻ với đơn vị không chia được
-- (Unit.accepts). Phiếu nhập vẫn số nguyên: mua theo kg, theo chai.

--changeset qltb:084-unit-allows-fraction
ALTER TABLE units ADD COLUMN allows_fraction BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE units SET allows_fraction = TRUE WHERE code IN ('KG', 'MET');
INSERT INTO units (code, name, sort_order, active, allows_fraction, created_at)
SELECT v.code, v.name, v.sort_order, TRUE, TRUE, now()
FROM (VALUES ('G', 'Gam', 20), ('LIT', 'Lít', 21), ('ML', 'Mililít', 22)) AS v(code, name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM units u WHERE u.code = v.code);
--rollback ALTER TABLE units DROP COLUMN allows_fraction;

--changeset qltb:084-fractional-quantities
ALTER TABLE equipment ALTER COLUMN quantity TYPE NUMERIC(14, 3);
ALTER TABLE stock_issue_lines ALTER COLUMN quantity TYPE NUMERIC(14, 3);
ALTER TABLE consumption_records ALTER COLUMN quantity TYPE NUMERIC(14, 3);
--rollback SELECT 1;
