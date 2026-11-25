--liquibase formatted sql

-- Khai số dư đầu kỳ = NHẬP DỮ LIỆU ĐẦU VÀO từ tệp (theo trưởng nhóm): tài sản trường đang có lúc đưa
-- hệ thống vào chạy được khai hàng loạt bằng tệp Excel, không gõ từng cái.
--
-- `075` gỡ `data_transfer:*` khỏi hai vai trường và hẹn "khi xây CS-09 thì cấp lại read/write cho
-- SCHOOL_LEADER bằng changelog riêng" — đây là changelog đó. Chỉ read/write (tải tệp mẫu, xem trước,
-- nhập), KHÔNG export: xuất toàn bộ dữ liệu vẫn là việc của Quản trị viên (TH-08).
--
-- Không mở thêm gì về dữ liệu: mỗi loại dữ liệu nhập còn đòi chính mã quyền tạo của nó
-- (`ImportTarget.permission()` — `equipment:write`, `staff:write`), và trường nhận luôn là trường
-- của người gọi (`ImportService.resolveSchool` + phạm vi `VisibleSchools`).

--changeset qltb:106-school-leader-opening-import
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('data_transfer:read', 'data_transfer:write')
WHERE r.code = 'SCHOOL_LEADER'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
--rollback DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = 'SCHOOL_LEADER') AND permission_id IN (SELECT id FROM permissions WHERE code IN ('data_transfer:read', 'data_transfer:write'));
