--liquibase formatted sql

-- Số thứ tự (ST) trong mã tài sản TT.TR.MH.LT.ST.NC tăng từ HAI lên BA chữ số: một bộ đếm
-- TT.TR.MH.LT.NC chứa 999 tài sản một năm thay vì 99 — một trường mua 100 bộ bàn ghế trong
-- năm không còn bị chặn cả phiếu. EquipmentCodeService cấp mã mới theo %03d; ở đây đổi mã ĐÃ
-- CẤP cho khớp chuẩn mới (07 → 007), không thì mọi tài sản cũ thành "hồ sơ chưa chuẩn" và bị
-- chặn ở mọi phiếu. Bộ đếm là số nên không phải đổi. Mỗi lần đổi mã ghi một dòng lịch sử.

--changeset qltb:082-equipment-code-three-digit-sequence
--comment Đổi ST của mã tài sản đã cấp từ 2 sang 3 chữ số (79.T6.00.TB.07.19 -> 79.T6.00.TB.007.19), ghi lịch sử.
CREATE TEMPORARY TABLE code_st3 ON COMMIT DROP AS
SELECT id, code AS old_code,
       regexp_replace(code, '^([0-9]{2}\.[A-Z0-9]{2}\.[0-9]{2}\.(TB|PM|HL))\.([0-9]{2})\.([0-9]{2})$', '\1.0\3.\4') AS new_code
FROM equipment
WHERE code ~ '^[0-9]{2}\.[A-Z0-9]{2}\.[0-9]{2}\.(TB|PM|HL)\.[0-9]{2}\.[0-9]{2}$';

UPDATE equipment e SET code = c.new_code, updated_at = now()
FROM code_st3 c WHERE e.id = c.id;

INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, note, created_at)
SELECT id, 'CAP_NHAT', 'code', old_code, new_code, 'Số thứ tự trong mã chuyển sang ba chữ số', now()
FROM code_st3;
--rollback SELECT 1;
