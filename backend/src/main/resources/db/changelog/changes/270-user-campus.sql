--liquibase formatted sql

--changeset luudong:270-user-campus
-- Phạm vi cơ sở của tài khoản trường: trống = cả trường; có = chỉ thấy, chỉ sửa dữ liệu của cơ sở đó (phòng, khối nhà,
-- thiết bị… — cơ sở thực của phòng theo FacilityCounting). Cơ sở bị xoá thì tài khoản về cả trường.
ALTER TABLE user_schools ADD COLUMN campus_id BIGINT NULL REFERENCES campuses (id) ON DELETE SET NULL;
CREATE INDEX ix_user_schools_campus ON user_schools (campus_id);
