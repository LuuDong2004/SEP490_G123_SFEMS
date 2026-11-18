--liquibase formatted sql

-- Thông tin khác của thiết bị (cấu hình, công suất, xuất xứ, kích thước…): một ô chữ tự do, khai ở dòng phiếu ghi
-- tăng (theo lô) và chép xuống từng tài sản khi duyệt. Không thiết kế từng trường theo loại (trưởng nhóm 13/11/2026):
-- không báo cáo nào tính theo các thông số này; Model / Hãng giữ ô riêng như cũ.

--changeset qltb:250-intake-other-info
ALTER TABLE equipment_intake_lines ADD COLUMN other_info VARCHAR(500);
ALTER TABLE equipment ADD COLUMN other_info VARCHAR(500);
--rollback ALTER TABLE equipment DROP COLUMN other_info; ALTER TABLE equipment_intake_lines DROP COLUMN other_info;
