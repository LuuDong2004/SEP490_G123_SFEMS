--liquibase formatted sql

--changeset qltb:233-users-drop-unit-columns
-- Đơn vị công tác đã sang bảng con (232): bỏ cột cũ ở users cùng CHECK ghép của 218. Từ đây "tài khoản Sở có trường"
-- không còn chỗ để ghi — bảng user_sos không có cột school_id.
ALTER TABLE users DROP CONSTRAINT ck_users_user_type;
ALTER TABLE users ADD CONSTRAINT ck_users_user_type CHECK (user_type IN ('SYSTEM', 'SO', 'UBND', 'SCHOOL'));
DROP INDEX IF EXISTS idx_users_school;
DROP INDEX IF EXISTS idx_users_managing_body;
ALTER TABLE users DROP COLUMN school_id;
ALTER TABLE users DROP COLUMN managing_body_id;
