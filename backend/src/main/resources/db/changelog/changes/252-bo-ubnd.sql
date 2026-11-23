--liquibase formatted sql

--changeset luudong:252-bo-ubnd splitStatements:false
--comment Phạm vi đồ án SFEMS chỉ có hai cấp quản lý: Sở GD&ĐT và trường (danh sách UC, Báo cáo 3) — bỏ UBND phường / xã. Trường đang trực thuộc UBND chuyển sang Sở; tài khoản, vai và cơ quan UBND bị xoá; loại tài khoản / loại vai còn SYSTEM · SO · SCHOOL.

-- 1. Trường trực thuộc UBND chuyển về Sở (hệ thống có đúng một Sở — dừng nếu không đúng như vậy).
DO $$
DECLARE so_id BIGINT;
BEGIN
    IF (SELECT count(*) FROM departments_of_education WHERE type = 'SO') <> 1 THEN
        RAISE EXCEPTION '252: cần đúng một cơ quan loại SO để chuyển trường của UBND sang';
    END IF;
    SELECT id INTO so_id FROM departments_of_education WHERE type = 'SO';
    UPDATE schools SET department_of_education_id = so_id
    WHERE department_of_education_id IN (SELECT id FROM departments_of_education WHERE type <> 'SO');
    UPDATE inventory_campaigns SET managing_body_id = so_id
    WHERE managing_body_id IN (SELECT id FROM departments_of_education WHERE type <> 'SO');
    UPDATE procurement_plans SET managing_body_id = so_id
    WHERE managing_body_id IN (SELECT id FROM departments_of_education WHERE type <> 'SO');
    UPDATE report_snapshots SET body_id = so_id
    WHERE body_id IN (SELECT id FROM departments_of_education WHERE type <> 'SO');
END $$;

-- 2. Tài khoản UBND (chỉ là tài khoản demo, chưa lập / duyệt chứng từ nào) và vai UBND.
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE user_type = 'UBND');
DELETE FROM user_ubnds;
DELETE FROM users WHERE user_type = 'UBND';
DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE role_type = 'UBND');
DELETE FROM roles WHERE role_type = 'UBND';
DROP TABLE user_ubnds;

-- 3. Cơ quan quản lý UBND / khác — không còn ai tham chiếu sau bước 1, 2.
DELETE FROM departments_of_education WHERE type <> 'SO';

-- 4. Ràng buộc loại: bỏ UBND.
ALTER TABLE users DROP CONSTRAINT ck_users_user_type;
ALTER TABLE users ADD CONSTRAINT ck_users_user_type CHECK (user_type IN ('SYSTEM', 'SO', 'SCHOOL'));
ALTER TABLE roles DROP CONSTRAINT ck_roles_role_type;
ALTER TABLE roles ADD CONSTRAINT ck_roles_role_type CHECK (role_type IN ('SYSTEM', 'SO', 'SCHOOL'));
