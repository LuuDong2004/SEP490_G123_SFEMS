--liquibase formatted sql

--changeset luudong:271-staff-campus
-- Cơ sở làm việc của cán bộ (giai đoạn 3 của phạm vi cơ sở): trống = cơ sở chính. Tài khoản một cơ sở chỉ thấy cán
-- bộ của cơ sở đó; đáp ứng thiết bị tối thiểu, biểu số liệu CSVC đếm giáo viên theo cơ sở. Cơ sở bị xoá → trống.
ALTER TABLE staff ADD COLUMN campus_id BIGINT NULL REFERENCES campuses (id) ON DELETE SET NULL;
CREATE INDEX ix_staff_campus ON staff (campus_id);

--changeset luudong:271-inventory-campus
-- Kiểm kê "toàn cơ sở": tài khoản một cơ sở lập kiểm kê không chọn phòng thì biên bản chỉ phủ cơ sở của mình (cột này);
-- không chặn kiểm kê toàn cơ sở của cơ sở khác. Phòng trống và cột này trống = cả trường (chặn mọi kiểm kê khác).
ALTER TABLE inventory_sessions ADD COLUMN campus_id BIGINT NULL REFERENCES campuses (id) ON DELETE SET NULL;
