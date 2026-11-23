--liquibase formatted sql

--changeset qltb:234-drop-viewer-teacher-roles splitStatements:false
-- Bỏ tài khoản mẫu viewer và hai vai Giáo viên (TEACHER), Trưởng bộ môn (SUBJECT_HEAD) — người dùng hệ thống chỉ là
-- Sở, UBND, lãnh đạo trường, cán bộ thiết bị và quản trị. Tài khoản đang mang hai vai này mất vai đó (vẫn còn vai khác
-- nếu có); chính sách phạm vi dòng của hai vai đi theo (ON DELETE CASCADE).
DO $$
DECLARE
    affected INT;
BEGIN
    DELETE FROM users WHERE username = 'viewer';

    SELECT count(DISTINCT ur.user_id) INTO affected
    FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE r.code IN ('TEACHER', 'SUBJECT_HEAD');

    DELETE FROM user_roles
    WHERE role_id IN (SELECT id FROM roles WHERE code IN ('TEACHER', 'SUBJECT_HEAD'));
    DELETE FROM roles WHERE code IN ('TEACHER', 'SUBJECT_HEAD');

    IF affected > 0 THEN
        RAISE NOTICE '234: % tài khoản mất vai TEACHER / SUBJECT_HEAD', affected;
    END IF;
END $$;
