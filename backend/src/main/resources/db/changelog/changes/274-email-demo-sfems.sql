--liquibase formatted sql

--changeset luudong:274-email-demo-sfems
--comment Email của tài khoản dùng thử theo tên dự án: @demo.qltb.vn → @demo.sfems.vn, @qltb.local → @sfems.local.
UPDATE users SET email = replace(email, '@demo.qltb.vn', '@demo.sfems.vn') WHERE email LIKE '%@demo.qltb.vn';
UPDATE users SET email = replace(email, '@qltb.local', '@sfems.local') WHERE email LIKE '%@qltb.local';
--rollback UPDATE users SET email = replace(email, '@demo.sfems.vn', '@demo.qltb.vn') WHERE email LIKE '%@demo.sfems.vn'; UPDATE users SET email = replace(email, '@sfems.local', '@qltb.local') WHERE email LIKE '%@sfems.local';
