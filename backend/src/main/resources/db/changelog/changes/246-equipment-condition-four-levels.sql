--liquibase formatted sql

--changeset qltb:246-equipment-condition-four-levels
-- Tình trạng thiết bị còn 4 mức: Tốt, Trung bình, Kém, Hỏng. Khá gộp vào Trung bình; Không sử dụng (được) gộp vào Hỏng.
UPDATE equipment SET condition = 'TRUNG_BINH' WHERE condition = 'KHA';
UPDATE equipment SET condition = 'HONG' WHERE condition = 'KHONG_SU_DUNG';
UPDATE inventory_lines SET expected_condition = 'TRUNG_BINH' WHERE expected_condition = 'KHA';
UPDATE inventory_lines SET expected_condition = 'HONG' WHERE expected_condition = 'KHONG_SU_DUNG';
UPDATE inventory_lines SET found_condition = 'TRUNG_BINH' WHERE found_condition = 'KHA';
UPDATE inventory_lines SET found_condition = 'HONG' WHERE found_condition = 'KHONG_SU_DUNG';
UPDATE maintenance_orders SET condition_after = 'TRUNG_BINH' WHERE condition_after = 'KHA';
UPDATE maintenance_orders SET condition_after = 'HONG' WHERE condition_after = 'KHONG_SU_DUNG';
UPDATE repair_orders SET condition_after = 'TRUNG_BINH' WHERE condition_after = 'KHA';
UPDATE repair_orders SET condition_after = 'HONG' WHERE condition_after = 'KHONG_SU_DUNG';
UPDATE equipment_transfer_lines SET condition = 'TRUNG_BINH' WHERE condition = 'KHA';
UPDATE equipment_transfer_lines SET condition = 'HONG' WHERE condition = 'KHONG_SU_DUNG';
UPDATE equipment_transfer_lines SET received_condition = 'TRUNG_BINH' WHERE received_condition = 'KHA';
UPDATE equipment_transfer_lines SET received_condition = 'HONG' WHERE received_condition = 'KHONG_SU_DUNG';
UPDATE warranty_claims SET condition_before = 'TRUNG_BINH' WHERE condition_before = 'KHA';
UPDATE warranty_claims SET condition_before = 'HONG' WHERE condition_before = 'KHONG_SU_DUNG';
UPDATE warranty_claims SET condition_after = 'TRUNG_BINH' WHERE condition_after = 'KHA';
UPDATE warranty_claims SET condition_after = 'HONG' WHERE condition_after = 'KHONG_SU_DUNG';
