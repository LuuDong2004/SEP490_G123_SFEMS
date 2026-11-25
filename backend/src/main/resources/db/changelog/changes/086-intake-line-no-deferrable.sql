--liquibase formatted sql

-- Dòng phiếu nhập giờ được SỬA TẠI CHỖ khi lưu lại phiếu (giữ id để tệp hoá đơn gắn theo dòng
-- không bị bỏ rơi), nên xoá hay đảo thứ tự dòng là đổi line_no của dòng đang có. Hibernate đẩy
-- UPDATE trước DELETE trong một lần flush, và ràng buộc kiểm ngay từng câu thì vấp đúng lúc hai
-- dòng tạm thời cùng số. Kiểm cuối giao dịch: số dòng vẫn duy nhất, chỉ không bắt giữa chừng.

--changeset qltb:086-intake-line-no-deferrable
ALTER TABLE equipment_intake_lines DROP CONSTRAINT uq_equipment_intake_lines_no;
ALTER TABLE equipment_intake_lines
    ADD CONSTRAINT uq_equipment_intake_lines_no UNIQUE (intake_id, line_no) DEFERRABLE INITIALLY DEFERRED;
--rollback ALTER TABLE equipment_intake_lines DROP CONSTRAINT uq_equipment_intake_lines_no; ALTER TABLE equipment_intake_lines ADD CONSTRAINT uq_equipment_intake_lines_no UNIQUE (intake_id, line_no);
