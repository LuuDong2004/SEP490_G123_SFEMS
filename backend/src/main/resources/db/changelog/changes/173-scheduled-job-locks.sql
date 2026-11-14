--liquibase formatted sql

--changeset qltb:173-scheduled-job-locks
-- Khoá của tác vụ hẹn giờ (JobLock): nhiều node thì mỗi lượt nhắc mượn quá hạn, nhắc bảo trì, sao lưu, kiểm dung
-- lượng chỉ một node chạy. Một dòng một tác vụ; node nào đổi được locked_until sang tương lai thì được chạy.
CREATE TABLE scheduled_job_locks (
    name         VARCHAR(64)              PRIMARY KEY,
    locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
    locked_at    TIMESTAMP WITH TIME ZONE,
    locked_by    VARCHAR(255)
);
