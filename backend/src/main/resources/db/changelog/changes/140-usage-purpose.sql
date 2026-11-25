--liquibase formatted sql

--changeset qltb:140-usage-purpose
-- QLTB-531: "Mục đích" của phiếu mượn phòng và phiếu mượn thiết bị không còn là chữ gõ tự do — gõ tự do thì
-- không thống kê được theo môn và theo tỷ lệ tiết thực hành. Tách thành:
--   purpose_type    mục đích CHỌN trong danh sách cố định (UsagePurpose);
--   purpose_note    ghi rõ khi chọn "Khác";
--   subject_id      môn học (bắt buộc với tiết học lý thuyết / thực hành);
--   lesson_content  nội dung bài dạy, chữ tự do, không bắt buộc.
-- Chữ đã gõ ở cột purpose cũ chép sang lesson_content để không mất. Mục đích của phiếu cũ để trống ("chưa
-- phân loại") — đoán từ chữ tự do thì đoán sai còn tệ hơn để trống. Cột purpose cũ giữ lại để đối chiếu.
--
-- Viết để CHẠY LẠI KHÔNG LỖI (IF NOT EXISTS, bỏ ràng buộc rồi đặt lại): bản đầu mang số 139 đã chạy trên máy
-- phát triển trước khi đổi số vì trùng 139-loan-times-as-text; chép chữ cũ chỉ điền ô còn trống.
ALTER TABLE room_bookings
    ADD COLUMN IF NOT EXISTS purpose_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS purpose_note VARCHAR(255),
    ADD COLUMN IF NOT EXISTS subject_id BIGINT REFERENCES subjects (id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS lesson_content VARCHAR(1000);

ALTER TABLE equipment_loans
    ADD COLUMN IF NOT EXISTS purpose_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS purpose_note VARCHAR(255),
    ADD COLUMN IF NOT EXISTS subject_id BIGINT REFERENCES subjects (id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS lesson_content VARCHAR(1000);

ALTER TABLE room_bookings DROP CONSTRAINT IF EXISTS ck_room_bookings_purpose_type;
ALTER TABLE room_bookings ADD CONSTRAINT ck_room_bookings_purpose_type CHECK (purpose_type IN
    ('THEORY', 'PRACTICE', 'EXTRACURRICULAR', 'PROFESSIONAL', 'TRAINING', 'OTHER'));

ALTER TABLE equipment_loans DROP CONSTRAINT IF EXISTS ck_equipment_loans_purpose_type;
ALTER TABLE equipment_loans ADD CONSTRAINT ck_equipment_loans_purpose_type CHECK (purpose_type IN
    ('THEORY', 'PRACTICE', 'EXTRACURRICULAR', 'PROFESSIONAL', 'TRAINING', 'OTHER'));

UPDATE room_bookings SET lesson_content = purpose
WHERE lesson_content IS NULL AND purpose IS NOT NULL AND btrim(purpose) <> '';
UPDATE equipment_loans SET lesson_content = purpose
WHERE lesson_content IS NULL AND purpose IS NOT NULL AND btrim(purpose) <> '';

--rollback ALTER TABLE equipment_loans DROP CONSTRAINT ck_equipment_loans_purpose_type, DROP COLUMN lesson_content, DROP COLUMN subject_id, DROP COLUMN purpose_note, DROP COLUMN purpose_type;
--rollback ALTER TABLE room_bookings DROP CONSTRAINT ck_room_bookings_purpose_type, DROP COLUMN lesson_content, DROP COLUMN subject_id, DROP COLUMN purpose_note, DROP COLUMN purpose_type;
