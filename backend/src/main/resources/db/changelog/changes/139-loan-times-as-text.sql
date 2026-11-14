--liquibase formatted sql

--changeset qltb:139-loan-times-as-text
-- Giờ mượn / hẹn trả / trả (134) lưu bằng chữ "HH:mm:ss" như giờ mượn phòng (LocalTimeText), không bằng TIME.
-- Với hibernate.jdbc.time_zone=UTC, Hibernate dịch giờ trong ngày theo múi giờ của máy chạy ứng dụng, tính trên
-- ngày 1/1/1970 (Sài Gòn khi đó là UTC+8): máy múi giờ Việt Nam lưu 07:30 thành 23:30. Đọc ra vẫn cộng lại nên
-- màn hình trông đúng, nhưng mọi phép so bằng SQL — bộ lọc "Quá hạn", tác vụ nhắc trả — so trên giá trị đã dịch:
-- hạn 07:15 không bao giờ thành quá hạn trong ngày. Máy chủ chạy Docker mặc định UTC nên giá trị đã lưu ở đó
-- đúng, giữ nguyên khi đổi kiểu; dữ liệu thử nhập từ máy múi giờ Việt Nam thì vẫn lệch như lúc nhập.
ALTER TABLE equipment_loans
    ALTER COLUMN loan_time TYPE VARCHAR(8) USING to_char(loan_time, 'HH24:MI:SS'),
    ALTER COLUMN due_time TYPE VARCHAR(8) USING to_char(due_time, 'HH24:MI:SS'),
    ALTER COLUMN returned_time TYPE VARCHAR(8) USING to_char(returned_time, 'HH24:MI:SS');

ALTER TABLE equipment_loan_lines
    ALTER COLUMN returned_time TYPE VARCHAR(8) USING to_char(returned_time, 'HH24:MI:SS');

--rollback ALTER TABLE equipment_loan_lines ALTER COLUMN returned_time TYPE TIME USING returned_time::time;
--rollback ALTER TABLE equipment_loans ALTER COLUMN loan_time TYPE TIME USING loan_time::time, ALTER COLUMN due_time TYPE TIME USING due_time::time, ALTER COLUMN returned_time TYPE TIME USING returned_time::time;
