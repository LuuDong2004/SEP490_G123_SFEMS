--liquibase formatted sql

--changeset luudong:292-go-nghiep-vu-ngoai-pham-vi splitStatements:false
--comment Gỡ phần còn sót của nghiệp vụ ngoài phạm vi (mượn phòng, khấu hao, ghi giảm, điều chuyển, sửa chữa) ở cột và dữ liệu nền
-- 292 (nối 285): code không còn đọc các cột này. CHECK ck_equipment_catalogs_useful_life đi theo cột.
ALTER TABLE rooms DROP COLUMN IF EXISTS loanable;
ALTER TABLE room_types DROP COLUMN IF EXISTS loanable;
ALTER TABLE equipment_catalogs DROP COLUMN IF EXISTS depreciation_method;
ALTER TABLE equipment_catalogs DROP COLUMN IF EXISTS useful_life_years;
ALTER TABLE school_year_closing_lines DROP COLUMN IF EXISTS pending_disposal;

-- Lý do biến động: chỉ còn loại ghi tăng (ReasonType.GHI_TANG). Bảng không bị khoá ngoại nào trỏ tới.
DELETE FROM movement_reasons WHERE code = 'GT05' AND name = 'Nhập lại sau sửa chữa, bảo hành';
DELETE FROM movement_reasons WHERE reason_type <> 'GHI_TANG';
UPDATE movement_reasons SET name = 'Được cấp phát, bàn giao', updated_at = now()
WHERE code = 'GT02' AND name = 'Được cấp phát, điều chuyển đến';
ALTER TABLE movement_reasons ALTER COLUMN reason_type SET DEFAULT 'GHI_TANG';

-- Trạng thái thiết bị: bốn giá trị của AssetStatus. DB đang chạy không có dòng nào khác, chỉ DB dựng mới từ đầu (dữ liệu
-- mẫu 219) mới có — không quy về thì Hibernate không đọc được dòng đó.
UPDATE equipment SET status = CASE
        WHEN status IN ('REPAIRING', 'UNREPAIRABLE', 'WARRANTY', 'PENDING_LIQUIDATION', 'PENDING_DESTRUCTION') THEN 'BROKEN'
        WHEN status IN ('MISSING', 'LIQUIDATED', 'DESTROYED', 'NOT_DELIVERED', 'USED_UP') THEN 'LOST'
        WHEN room_id IS NULL THEN 'IN_STOCK'
        ELSE 'IN_USE' END
WHERE status NOT IN ('IN_STOCK', 'IN_USE', 'BROKEN', 'LOST');
-- Lịch sử: giữ nguyên dòng, hành động của nghiệp vụ đã gỡ quy về cập nhật hồ sơ, nhãn trạng thái Hỏng theo tên mới.
UPDATE equipment_history SET action = 'CAP_NHAT' WHERE action NOT IN ('GHI_TANG', 'CAP_NHAT', 'KIEM_KE');
UPDATE equipment_history SET from_value = 'Hỏng' WHERE field = 'status' AND from_value = 'Hỏng, chờ xử lý';
UPDATE equipment_history SET to_value = 'Hỏng' WHERE field = 'status' AND to_value = 'Hỏng, chờ xử lý';

-- Bước duyệt "cơ quan của trường nhận" (phiếu điều chuyển) không còn: phạm vi dòng của Sở còn liệt kê nó thì lúc đọc
-- chính sách không đổi được chuỗi đó ra ApprovalStep.
UPDATE row_level_policy SET scope = replace(scope::text, ', "RECEIVING_BODY"', '')::jsonb, updated_at = now()
WHERE scope::text LIKE '%, "RECEIVING_BODY"%';
UPDATE row_level_policy SET check_scope = replace(check_scope::text, ', "RECEIVING_BODY"', '')::jsonb, updated_at = now()
WHERE check_scope::text LIKE '%, "RECEIVING_BODY"%';

-- Câu chữ còn nhắc nghiệp vụ đã gỡ.
UPDATE code_rules SET name = 'Lý do biến động' WHERE code = 'MOVEMENT_REASON' AND name = 'Lý do điều chuyển/sửa chữa/thanh lý';
UPDATE roles SET description = replace(description, 'kiểm kê, bảo trì, nhu cầu', 'kiểm kê, nhu cầu')
WHERE description LIKE '%kiểm kê, bảo trì, nhu cầu%';
--rollback SELECT 1;
