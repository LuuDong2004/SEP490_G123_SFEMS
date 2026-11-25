--liquibase formatted sql

--changeset qltb:238-main-drop-subject-head-accounts splitStatements:false
--preconditions onFail:CONTINUE onError:HALT
--precondition-sql-check expectedResult:1 SELECT CASE WHEN '${appStack}' = 'qltb_main' THEN 1 ELSE 0 END
-- Chỉ trên qltb_main. 234 bỏ vai Trưởng bộ môn (SUBJECT_HEAD), nên bốn tài khoản tổ trưởng kiểm thử của 215 không còn
-- vai nào. Xoá hẳn (theo trưởng nhóm, 12/11/2026), như 216 đã bỏ tài khoản giáo viên. Tài khoản nào đã gắn chứng từ
-- không cho xoá (khoá ngoại) thì khoá lại, không làm hỏng lần triển khai.
DO $$
DECLARE
    name TEXT;
BEGIN
    FOREACH name IN ARRAY ARRAY['79000f01.tt01', '79760414.tt01', '79760502.tt01', '79760503.tt01'] LOOP
        BEGIN
            DELETE FROM users WHERE username = name;
        EXCEPTION WHEN foreign_key_violation THEN
            UPDATE users SET status = 'INACTIVE' WHERE username = name;
            RAISE NOTICE '238: % còn chứng từ gắn vào — khoá thay vì xoá', name;
        END;
    END LOOP;
END $$;
