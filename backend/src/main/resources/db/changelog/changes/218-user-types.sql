--liquibase formatted sql

--changeset qltb:218-user-types splitStatements:false
-- Bốn loại tài khoản (docs/kien-truc/11): SYSTEM · SO · UBND · SCHOOL — cột phân loại của kế thừa `User`
-- (SystemUser / SoUser / UbndUser / SchoolUser, một bảng). Loại suy từ đơn vị công tác của dữ liệu hiện có:
--   1. có trường → SCHOOL (lỡ có cả cơ quan quản lý thì bỏ cơ quan — tài khoản trường không gắn cơ quan);
--   2. có cơ quan quản lý → SO nếu cơ quan là Sở, còn lại UBND;
--   3. không đơn vị mà mang vai Sở (SO_*) và cả hệ thống có ĐÚNG MỘT Sở → SO, gắn vào Sở đó;
--   4. còn lại → SYSTEM.
-- Ràng buộc ck_users_user_type giữ mỗi loại đúng đơn vị từ nay về sau.
ALTER TABLE users ADD COLUMN user_type VARCHAR(16);

UPDATE users SET managing_body_id = NULL WHERE school_id IS NOT NULL AND managing_body_id IS NOT NULL;
UPDATE users SET user_type = 'SCHOOL' WHERE school_id IS NOT NULL;
UPDATE users u SET user_type = CASE WHEN d.type = 'SO' THEN 'SO' ELSE 'UBND' END
FROM departments_of_education d
WHERE u.user_type IS NULL AND d.id = u.managing_body_id;

DO $$
DECLARE so_id BIGINT;
BEGIN
    IF (SELECT count(*) FROM departments_of_education WHERE type = 'SO') = 1 THEN
        SELECT id INTO so_id FROM departments_of_education WHERE type = 'SO';
        UPDATE users u SET user_type = 'SO', managing_body_id = so_id
        WHERE u.user_type IS NULL
          AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                      WHERE ur.user_id = u.id AND r.code LIKE 'SO\_%');
    END IF;
END $$;

UPDATE users SET user_type = 'SYSTEM' WHERE user_type IS NULL;

ALTER TABLE users ALTER COLUMN user_type SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT ck_users_user_type CHECK (
    (user_type = 'SYSTEM' AND school_id IS NULL AND managing_body_id IS NULL)
    OR (user_type = 'SCHOOL' AND school_id IS NOT NULL AND managing_body_id IS NULL)
    OR (user_type IN ('SO', 'UBND') AND school_id IS NULL AND managing_body_id IS NOT NULL));
CREATE INDEX idx_users_user_type ON users (user_type);
--rollback ALTER TABLE users DROP CONSTRAINT ck_users_user_type; DROP INDEX idx_users_user_type; ALTER TABLE users DROP COLUMN user_type;
