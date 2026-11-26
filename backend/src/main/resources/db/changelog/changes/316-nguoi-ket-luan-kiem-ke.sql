--liquibase formatted sql

--changeset luudong:316-nguoi-ket-luan-kiem-ke
--comment Biên bản kiểm kê ghi AI kết luận (thường là chủ tịch hội đồng / tổ trưởng tổ kiểm kê, có thể là người ngoài tổ): họ tên, cùng khối "Kết luận" với nội dung kết luận.
ALTER TABLE inventory_sessions ADD COLUMN concluded_by VARCHAR(100);
--rollback ALTER TABLE inventory_sessions DROP COLUMN concluded_by;
