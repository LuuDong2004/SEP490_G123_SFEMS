--liquibase formatted sql

--changeset qltb:176-loan-due-reminder
-- Nhắc trước hạn trả phiếu mượn (LoanReminderJob): mỗi phiếu một lần cho mốc này.
ALTER TABLE equipment_loans ADD COLUMN due_reminded_at TIMESTAMP WITH TIME ZONE;
-- Không điền cho phiếu cũ: phiếu đã quá hạn không lọt vào lời nhắc trước hạn (chỉ xét hạn từ hôm nay).

--rollback ALTER TABLE equipment_loans DROP COLUMN due_reminded_at;
