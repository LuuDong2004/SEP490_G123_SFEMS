--liquibase formatted sql

-- Mã Loại thiết bị là HAI CHỮ CÁI (QLTB-419), không phải tên viết hoa nối gạch của `098`
-- (THIET_BI_DUNG_CHUNG, HOA_CHAT…). Mười loại là mười nhóm của phụ lục danh mục tối thiểu.
--
-- Mã này KHÔNG đi vào mã tài sản: thành phần LT của mã TT.TR.MH.LT.ST.NC là TB / PM / HL (thiết bị
-- vật lý / phần mềm / hệ thống hỗ trợ học tập — `physical_or_digital` của thiết bị), nên không có
-- mã tài sản nào phải cấp lại. Vì thế các mã dưới đây cố ý tránh TB, PM, HL: hai danh sách cùng có
-- chữ "loại", để chúng trùng chữ là để người đọc tem nhầm cái này với cái kia.
--
-- Quy tắc sinh mã của Sở cho danh mục này (`090`: LTB001…) được tắt: nó sinh mã sáu ký tự, ngược với
-- chuẩn hai chữ cái. Loại mới do người khai gõ mã.

--changeset qltb:111-equipment-type-short-codes
UPDATE equipment_types t SET code = v.new_code, updated_at = now()
FROM (VALUES
    ('THIET_BI_DUNG_CHUNG', 'DC'),
    ('TRANH_ANH', 'TA'),
    ('BAN_DO_LUOC_DO', 'BD'),
    ('MO_HINH_MAU_VAT', 'MV'),
    ('DUNG_CU', 'DU'),
    ('HOA_CHAT', 'HC'),
    ('HOC_LIEU_SO', 'HS'),
    ('NHAC_CU', 'NC'),
    ('THIET_BI_PHONG_BO_MON', 'BM'),
    ('KHAC', 'KH')) AS v (old_code, new_code)
WHERE t.code = v.old_code
  AND NOT EXISTS (SELECT 1 FROM equipment_types x WHERE x.code = v.new_code);

UPDATE code_rules SET active = FALSE, updated_at = now() WHERE target = 'equipment_types';
