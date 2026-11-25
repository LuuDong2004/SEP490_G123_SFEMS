--liquibase formatted sql

--changeset dth:040-add-user-managing-body
--comment Gắn tài khoản vào cơ quan chủ quản, để tài khoản Sở và UBND có phạm vi dữ liệu.

-- `users.school_id` (migration 016) trả lời "tài khoản này thuộc trường nào".
-- Nó không trả lời được cho tài khoản của Sở hay của UBND — họ không thuộc
-- trường nào cả, nhưng vẫn phải có phạm vi dữ liệu. Không có cột này thì chính
-- sách "UBND chỉ thấy trường trên địa bàn mình" không viết ra được: không có gì
-- để so sánh với `schools.department_of_education_id`.
--
-- Đi song song với `school_id` chứ không thay thế nó, vì hai câu hỏi khác nhau:
--   · người của trường     -> school_id khác rỗng, managing_body_id rỗng
--   · người của Sở / UBND  -> managing_body_id khác rỗng, school_id rỗng
--   · quản trị viên hệ thống -> cả hai rỗng, và phạm vi do vai trò quyết định
--
-- Không ràng buộc "đúng một trong hai khác rỗng": tài khoản quản trị hợp lệ mà
-- cả hai đều rỗng, và một người kiêm nhiệm cả hai phía là chuyện có thật.
--
-- RESTRICT cùng lý do như `school_id`: SET NULL sẽ lặng lẽ biến những tài khoản
-- đó thành "không thuộc đâu cả" — mất quyền truy cập mà không ai biết vì sao.
ALTER TABLE users
    ADD COLUMN managing_body_id BIGINT
        REFERENCES departments_of_education (id) ON DELETE RESTRICT;

-- "Những tài khoản của cơ quan này" là câu hỏi màn quản lý tài khoản hỏi mỗi
-- lần mở, và là bộ lọc phân quyền dòng sẽ dùng nhiều.
CREATE INDEX idx_users_managing_body ON users (managing_body_id);
