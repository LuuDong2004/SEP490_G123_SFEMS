--liquibase formatted sql

-- Điều chuyển liên trường là chỉ đạo của Sở / UBND, không qua duyệt — căn cứ của phiếu là QUYẾT ĐỊNH, bắt buộc lúc
-- gửi bàn giao: số (đã có cột), ngày, cơ quan ra quyết định, tệp quyết định đính kèm.

--changeset qltb:181-transfer-decision
ALTER TABLE equipment_transfers ADD COLUMN IF NOT EXISTS decision_date DATE;
ALTER TABLE equipment_transfers ADD COLUMN IF NOT EXISTS decision_issuer VARCHAR(255);
