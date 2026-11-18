--liquibase formatted sql

-- Danh mục thiết bị tối thiểu đi theo BỘ, và bộ đi theo VĂN BẢN.
--
-- Một bộ tiêu chuẩn là một phiên bản danh mục theo một bộ văn bản căn cứ (TT 37/2021 + TT 26/2023 +
-- VBHN 02...). Thay đổi thiết bị nghĩa là có văn bản mới, nên không sửa lẻ trong bộ đang áp dụng:
-- lập bộ mới (chép từ bộ cũ) ở trạng thái NHÁP, sửa thiết bị + văn bản trong bản nháp, rồi ÁP DỤNG —
-- bộ cũ chuyển HẾT HIỆU LỰC, giữ nguyên để tra cứu.
--
--   DRAFT    đang soạn — thêm / sửa / xoá thiết bị được; chưa tính vào đủ / thiếu
--   ACTIVE   đang áp dụng — khoá thiết bị; mỗi cấp học đúng MỘT bộ (chỉ mục duy nhất có điều kiện)
--   RETIRED  hết hiệu lực — chỉ xem
--
-- `active` (cờ chung của danh mục) giữ đúng bằng status = ACTIVE, nên mọi truy vấn đang đọc
-- `sd.active` (AdequacyService) không phải đổi.
--
-- Mã dòng định mức chỉ cần duy nhất TRONG một bộ: bộ mới chép nguyên mã của bộ cũ (DM-TH-TOAN-001
-- ở bộ 2023 và ở bộ 2026 là cùng một dòng phụ lục, hai phiên bản).

--changeset qltb:099-standard-lifecycle
ALTER TABLE equipment_standards ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'DRAFT';
UPDATE equipment_standards SET status = CASE WHEN active THEN 'ACTIVE' ELSE 'RETIRED' END;
ALTER TABLE equipment_standards
    ADD CONSTRAINT ck_equipment_standards_status CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED'));
UPDATE equipment_standards SET active = (status = 'ACTIVE');
CREATE UNIQUE INDEX uq_equipment_standards_active_level
    ON equipment_standards (education_level_id) WHERE status = 'ACTIVE';

ALTER TABLE equipment_norms DROP CONSTRAINT IF EXISTS uq_equipment_norms_code;
DROP INDEX IF EXISTS uq_equipment_norms_code;
CREATE UNIQUE INDEX uq_equipment_norms_standard_code ON equipment_norms (standard_id, code);
