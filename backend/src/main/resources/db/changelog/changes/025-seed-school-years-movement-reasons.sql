--liquibase formatted sql

--changeset dth:025-seed-school-years-movement-reasons
--comment Mã quyền, phân quyền, 4 năm học và 14 lý do biến động.

-- Dữ liệu lấy từ bản Jmix (062-catalog-seed).
--
-- Năm học hiện hành là năm có hôm nay nằm trong khoảng — tính lúc migration
-- chạy chứ không ghim cứng, để một bản cài mới năm sau không khởi đầu với một
-- năm hiện hành đã cũ. Không năm nào khớp (cài vào kỳ nghỉ hè) thì không năm
-- nào được đánh dấu, và người quản trị chọn trên màn danh mục.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('school_years:read',   'Xem năm học', 'Xem danh sách và chi tiết năm học', TRUE),
  ('school_years:write',  'Sửa năm học', 'Thêm và sửa năm học',               TRUE),
  ('school_years:delete', 'Xoá năm học', 'Xoá vĩnh viễn một năm học',         TRUE),
  ('movement_reasons:read',   'Xem lý do biến động', 'Xem danh sách và chi tiết lý do biến động', TRUE),
  ('movement_reasons:write',  'Sửa lý do biến động', 'Thêm và sửa lý do biến động',               TRUE),
  ('movement_reasons:delete', 'Xoá lý do biến động', 'Xoá vĩnh viễn một lý do biến động',         TRUE);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('school_years:read', 'school_years:write', 'school_years:delete', 'movement_reasons:read', 'movement_reasons:write', 'movement_reasons:delete')
WHERE r.code = 'ADMIN';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('school_years:read', 'school_years:write', 'movement_reasons:read', 'movement_reasons:write')
WHERE r.code = 'MANAGER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('school_years:read', 'movement_reasons:read')
WHERE r.code = 'USER';

INSERT INTO school_years (code, name, sort_order, active, start_date, end_date, is_current, created_at) VALUES
  ('2023-2024', 'Năm học 2023-2024', 1, TRUE, DATE '2023-09-05', DATE '2024-05-31', CURRENT_DATE BETWEEN DATE '2023-09-05' AND DATE '2024-05-31', now()),
  ('2024-2025', 'Năm học 2024-2025', 2, TRUE, DATE '2024-09-05', DATE '2025-05-31', CURRENT_DATE BETWEEN DATE '2024-09-05' AND DATE '2025-05-31', now()),
  ('2025-2026', 'Năm học 2025-2026', 3, TRUE, DATE '2025-09-05', DATE '2026-05-31', CURRENT_DATE BETWEEN DATE '2025-09-05' AND DATE '2026-05-31', now()),
  ('2026-2027', 'Năm học 2026-2027', 4, TRUE, DATE '2026-09-05', DATE '2027-05-31', CURRENT_DATE BETWEEN DATE '2026-09-05' AND DATE '2027-05-31', now());

INSERT INTO movement_reasons (code, name, sort_order, active, reason_type, created_at) VALUES
  ('GT01', 'Mua sắm mới', 1, TRUE, 'GHI_TANG', now()),
  ('GT02', 'Được cấp phát, điều chuyển đến', 2, TRUE, 'GHI_TANG', now()),
  ('GT03', 'Tài trợ, viện trợ, biếu tặng', 3, TRUE, 'GHI_TANG', now()),
  ('GT04', 'Đơn vị tự làm, sưu tầm', 4, TRUE, 'GHI_TANG', now()),
  ('GT05', 'Nhập lại sau sửa chữa, bảo hành', 5, TRUE, 'GHI_TANG', now()),
  ('GT06', 'Kiểm kê thừa', 6, TRUE, 'GHI_TANG', now()),
  ('GT99', 'Lý do khác', 7, TRUE, 'GHI_TANG', now()),
  ('GG01', 'Cấp phát cho đơn vị sử dụng', 8, TRUE, 'GHI_GIAM', now()),
  ('GG02', 'Điều chuyển đi đơn vị khác', 9, TRUE, 'GHI_GIAM', now()),
  ('GG03', 'Thanh lý', 10, TRUE, 'GHI_GIAM', now()),
  ('GG04', 'Tiêu hủy', 11, TRUE, 'GHI_GIAM', now()),
  ('GG05', 'Mất, hư hỏng không sửa chữa được', 12, TRUE, 'GHI_GIAM', now()),
  ('GG06', 'Kiểm kê thiếu', 13, TRUE, 'GHI_GIAM', now()),
  ('GG99', 'Lý do khác', 14, TRUE, 'GHI_GIAM', now());
