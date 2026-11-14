--liquibase formatted sql

--changeset qltb:209-drop-facility-standard-adjustments
-- Bỏ chức năng điều chỉnh chuẩn CSVC tối thiểu theo trường (208): chấm chuẩn CSVC chỉ theo chuẩn chung của Sở.
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'facility\_standard\_adjustments:%');
DELETE FROM permissions WHERE code LIKE 'facility\_standard\_adjustments:%';
DROP TABLE IF EXISTS facility_standard_adjustment_lines;
DROP TABLE IF EXISTS facility_standard_adjustments;
