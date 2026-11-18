--liquibase formatted sql

--changeset qltb:245-drop-school-types
-- Bỏ danh mục Loại hình trường (178): CSDL của Sở chỉ quản lý trường công lập, không cần phân loại.
-- Nhập danh sách trường vẫn bỏ qua dòng ghi loại hình khác "Công lập" (lọc ngoài phạm vi, không lưu gì).
ALTER TABLE schools DROP COLUMN IF EXISTS school_type_id;
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'school\_types:%');
DELETE FROM permissions WHERE code LIKE 'school\_types:%';
DELETE FROM code_rules WHERE target = 'school_types';
DROP TABLE IF EXISTS school_types;
