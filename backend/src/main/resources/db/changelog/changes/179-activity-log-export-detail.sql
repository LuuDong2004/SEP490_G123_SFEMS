--liquibase formatted sql

--changeset qltb:179-activity-log-export-detail
-- Lần xuất dữ liệu ghi thêm định dạng (XLSX / PDF / CSV), số dòng và phạm vi / bộ lọc. In PDF và xuất CSV chạy
-- trên trình duyệt nên do màn hình báo lên (POST /api/activity_logs/exports); xuất Excel thì máy chủ tự ghi.
ALTER TABLE activity_logs ADD COLUMN export_format VARCHAR(10);
ALTER TABLE activity_logs ADD COLUMN row_count INTEGER;
ALTER TABLE activity_logs ADD COLUMN detail VARCHAR(1000);
--rollback ALTER TABLE activity_logs DROP COLUMN detail;
--rollback ALTER TABLE activity_logs DROP COLUMN row_count;
--rollback ALTER TABLE activity_logs DROP COLUMN export_format;
