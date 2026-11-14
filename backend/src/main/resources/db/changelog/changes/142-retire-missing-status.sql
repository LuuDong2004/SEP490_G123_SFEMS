--liquibase formatted sql

-- "Báo mất" không còn là một bước riêng (trưởng nhóm, 26/10). Ghi giảm do mất: vào Ghi giảm chọn tài sản còn trên sổ,
-- trình → tài sản thành "Chờ ghi giảm do mất" (giá trị MISSING cũ, đổi nghĩa), duyệt quyết định → "Mất" (LOST),
-- trả lại / từ chối → về trạng thái lúc trình, lưu ở `disposal_lines.status_before`. Kiểm kê không thấy và trả mượn
-- bị mất không đổi trạng thái nữa, chỉ sinh đề nghị ghi giảm nháp.
--
-- Dữ liệu cũ, theo thứ tự (ghi lịch sử TRƯỚC mỗi lần cập nhật, sau đó không còn phân biệt được dòng nào vừa đổi):
--   1. dòng của đề nghị ghi giảm do mất ĐANG CHỜ DUYỆT: nhớ trạng thái hiện tại (MISSING thì suy theo chỗ để);
--   2. tài sản của các dòng đó → MISSING ("chờ ghi giảm do mất") — để lúc duyệt cuối chúng đúng trạng thái phiếu đòi;
--   3. MISSING còn lại (không phiếu nào đang chờ giữ) → trong kho / đang sử dụng theo chỗ để, cùng quy tắc
--      `EquipmentService.isStoreroom`: không phòng hoặc phòng loại KHO → trong kho. Đề nghị nháp của chúng vẫn trình được.

--changeset qltb:142-retire-missing-status
ALTER TABLE disposal_lines ADD COLUMN IF NOT EXISTS status_before VARCHAR(30);

UPDATE disposal_lines dl
SET status_before = CASE WHEN e.status <> 'MISSING' THEN e.status
                         WHEN e.room_id IS NULL OR t.code = 'KHO' THEN 'IN_STOCK' ELSE 'IN_USE' END
FROM disposals d, equipment e
LEFT JOIN rooms r ON r.id = e.room_id
LEFT JOIN room_types t ON t.id = r.room_type_id
WHERE d.id = dl.disposal_id AND e.id = dl.equipment_id
  AND d.kind = 'LOSS' AND d.status = 'PENDING';

INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, note, created_at)
SELECT e.id, 'MAT', 'status',
       CASE e.status WHEN 'IN_STOCK' THEN 'Trong kho' WHEN 'IN_USE' THEN 'Đang sử dụng'
                     WHEN 'BROKEN' THEN 'Hỏng, chờ xử lý' ELSE e.status END,
       'Chờ ghi giảm do mất', 'Đang có đề nghị ghi giảm do mất chờ duyệt — chờ quyết định', now()
FROM equipment e
WHERE e.status <> 'MISSING'
  AND EXISTS (SELECT 1 FROM disposal_lines dl JOIN disposals d ON d.id = dl.disposal_id
              WHERE dl.equipment_id = e.id AND d.kind = 'LOSS' AND d.status = 'PENDING');

UPDATE equipment e
SET status = 'MISSING'
WHERE e.status <> 'MISSING'
  AND EXISTS (SELECT 1 FROM disposal_lines dl JOIN disposals d ON d.id = dl.disposal_id
              WHERE dl.equipment_id = e.id AND d.kind = 'LOSS' AND d.status = 'PENDING');

INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, note, created_at)
SELECT e.id, 'CAP_NHAT', 'status', 'Báo mất',
       CASE WHEN e.room_id IS NULL OR t.code = 'KHO' THEN 'Trong kho' ELSE 'Đang sử dụng' END,
       'Bỏ trạng thái "Báo mất" — tài sản chờ ghi giảm khi đề nghị ghi giảm do mất được trình', now()
FROM equipment e
LEFT JOIN rooms r ON r.id = e.room_id
LEFT JOIN room_types t ON t.id = r.room_type_id
WHERE e.status = 'MISSING'
  AND NOT EXISTS (SELECT 1 FROM disposal_lines dl JOIN disposals d ON d.id = dl.disposal_id
                  WHERE dl.equipment_id = e.id AND d.kind = 'LOSS' AND d.status = 'PENDING');

UPDATE equipment e
SET status = CASE WHEN e.room_id IS NULL OR t.code = 'KHO' THEN 'IN_STOCK' ELSE 'IN_USE' END
FROM equipment x
LEFT JOIN rooms r ON r.id = x.room_id
LEFT JOIN room_types t ON t.id = r.room_type_id
WHERE x.id = e.id
  AND e.status = 'MISSING'
  AND NOT EXISTS (SELECT 1 FROM disposal_lines dl JOIN disposals d ON d.id = dl.disposal_id
                  WHERE dl.equipment_id = e.id AND d.kind = 'LOSS' AND d.status = 'PENDING');
--rollback ALTER TABLE disposal_lines DROP COLUMN IF EXISTS status_before;
