--liquibase formatted sql

-- CHỈ Ở qltb_main: đổi mật khẩu chung của tài khoản kiểm thử sang mật khẩu đã ghi trong tài liệu "Môi trường kiểm thử"
-- gửi tư vấn giám sát / Chủ đầu tư (12/11/2026) — trưởng nhóm yêu cầu.
--
-- Chỉ đổi tài khoản CÒN mật khẩu mặc định: bản băm Demo@123 của 211 / 215 (Sở, UBND, trường) và bản băm Admin@123
-- của 005 (admin). Tài khoản nào người dùng đã tự đổi mật khẩu thì để yên. Mật khẩu mới không qua PasswordPolicy
-- (thiếu chữ hoa; vai Sở cần 12 ký tự) — luật chỉ kiểm lúc đặt / đổi, không kiểm lúc đăng nhập (như 211).
--changeset qltb:218-main-test-passwords
--preconditions onFail:CONTINUE onError:HALT
--precondition-sql-check expectedResult:1 SELECT CASE WHEN '${appStack}' = 'qltb_main' THEN 1 ELSE 0 END
UPDATE users
SET password_hash = '$2a$10$wiSu68Yi./gW5y.T5xlXeeTNyB28HkkMGXxh98FfDgNzknCnDWGRW',
    password_changed_at = now()
WHERE password_hash = '$2b$10$xWZ4pc40w3.ui50raa815ufbHe9Y6uTG/wGIPm5SAZQLS63UthxxS'
   OR (username = 'admin' AND password_hash = '$2a$10$ff7CTQvwMv0Szb.qGXF3zeMUkV8Jjta52A6kYzGDeZY4YE2pyd.YS');
