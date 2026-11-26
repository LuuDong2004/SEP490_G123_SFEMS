--liquibase formatted sql

--changeset luudong:298-xac-nhan-khai-nam-hoc
--comment Hồ sơ năm học bỏ Chốt và Mở lại, thay bằng Xác nhận đã khai không khoá. Năm đã chốt thành Đã xác nhận của cả trường. Bỏ quyền mở lại
INSERT INTO school_year_profiles (school_id, school_year_id, campus_id, status, confirmed_at, confirmed_by_id, updated_at)
SELECT c.school_id, c.school_year_id, NULL, 'CONFIRMED', c.closed_at, c.closed_by_id, c.closed_at
FROM school_year_closings c
WHERE c.status = 'CLOSED'
ON CONFLICT (school_id, school_year_id, (COALESCE(campus_id, 0))) DO UPDATE
SET status = 'CONFIRMED', confirmed_at = EXCLUDED.confirmed_at, confirmed_by_id = EXCLUDED.confirmed_by_id,
    updated_at = EXCLUDED.updated_at;

UPDATE permissions SET name = 'Xác nhận đã khai năm học',
    description = 'Lãnh đạo trường xác nhận đã khai dữ liệu năm học (lớp, phân công, phòng). Không khoá, vẫn sửa được'
WHERE code = 'school_year_profiles:confirm';
UPDATE permissions SET name = 'Khai dữ liệu năm học',
    description = 'Khai dữ liệu năm học mới: lên lớp, chép phân công giáo viên, điều chỉnh từ năm trước'
WHERE code = 'school_year_profiles:write';
UPDATE permissions SET description = 'Xem hồ sơ năm học của trường và tiến độ khai của các trường'
WHERE code = 'school_year_profiles:read';

DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'school_year_profiles:reopen');
DELETE FROM permissions WHERE code = 'school_year_profiles:reopen';
--rollback INSERT INTO permissions (code, name, description, system_permission, scope) VALUES ('school_year_profiles:reopen', 'Mở lại năm học đã chốt', 'Mở lại năm học đã chốt của trường mình quản lý (có lý do)', TRUE, 'ORGANIZATION') ON CONFLICT (code) DO NOTHING;
