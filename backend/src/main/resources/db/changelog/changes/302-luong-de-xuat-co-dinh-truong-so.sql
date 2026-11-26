--liquibase formatted sql

--changeset luudong:302-luong-de-xuat-co-dinh-truong-so
--comment Đề xuất mua sắm là trường xin Sở cấp kinh phí nên luồng duyệt cố định lãnh đạo trường rồi lãnh đạo Sở, không cấu hình được. Bỏ cấu hình đang có của đề xuất và bỏ ngưỡng tiền của luồng phê duyệt (chỉ đề xuất dùng ngưỡng).
DELETE FROM approval_flows WHERE resource = 'purchase_proposals';
ALTER TABLE approval_flows DROP CONSTRAINT IF EXISTS ck_approval_flows_above;
ALTER TABLE approval_flows DROP CONSTRAINT IF EXISTS ck_approval_flows_threshold;
ALTER TABLE approval_flows DROP COLUMN amount_threshold;
ALTER TABLE approval_flows DROP COLUMN steps_above;
