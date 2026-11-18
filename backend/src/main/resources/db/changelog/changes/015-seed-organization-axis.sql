--liquibase formatted sql

--changeset dth:015-seed-organization-axis
--comment Mã quyền cho hai resource departments_of_education và schools, phần cấp cho từng vai trò, và Sở GD&ĐT TP.HCM.

INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('departments_of_education:read',   'Xem Sở/Phòng GD',    'Xem danh sách và chi tiết Sở/Phòng GD', TRUE),
  ('departments_of_education:write',  'Sửa Sở/Phòng GD',    'Thêm và sửa Sở/Phòng GD',               TRUE),
  ('departments_of_education:delete', 'Xoá Sở/Phòng GD',    'Xoá vĩnh viễn một Sở/Phòng GD',         TRUE),
  ('schools:read',                    'Xem trường học',     'Xem danh sách và chi tiết trường học',  TRUE),
  ('schools:write',                   'Sửa trường học',     'Thêm và sửa trường học',                TRUE),
  ('schools:delete',                  'Xoá trường học',     'Xoá vĩnh viễn một trường học',          TRUE);

-- ADMIN nhận đủ sáu. Phải viết tường minh: 005 cấp cho ADMIN mọi quyền tồn tại
-- VÀO LÚC NÓ CHẠY, mà đó là phép join trên bảng chưa có sáu dòng này.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'departments_of_education:read', 'departments_of_education:write', 'departments_of_education:delete',
  'schools:read', 'schools:write', 'schools:delete')
WHERE r.code = 'ADMIN';

-- MANAGER (vai Sở) lập và sửa danh sách trường, nhưng chỉ ĐỌC được chính đơn
-- vị chủ quản của mình. Đó là ranh giới thật ngoài đời: Sở quản lý các trường
-- trực thuộc, còn việc lập ra một Sở là quyết định ở cấp cao hơn.
--
-- Không cấp schools:delete: một trường đã có thiết bị, phiếu và tài khoản trỏ
-- vào thì khoá ngoại RESTRICT sẽ từ chối xoá; thao tác đúng là chuyển trạng
-- thái sang "Ngưng hoạt động".
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'departments_of_education:read',
  'schools:read', 'schools:write')
WHERE r.code = 'MANAGER';

-- USER chỉ đọc. Cần quyền này vì tên trường xuất hiện ở gần như mọi màn
-- nghiệp vụ sau này; thiếu nó thì các ô đó rỗng mà không có lỗi nào.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('departments_of_education:read', 'schools:read')
WHERE r.code = 'USER';

-- Đơn vị chủ quản có thật của hệ thống này. KHÔNG seed trường nào: danh sách
-- trường là dữ liệu thật do người dùng nhập, và một trường giả trong database
-- lúc bàn giao là thứ có khả năng đi thẳng vào báo cáo.
INSERT INTO departments_of_education (code, name, province, address, status, created_at) VALUES
  ('SGD-HCM',
   'Sở Giáo dục và Đào tạo Thành phố Hồ Chí Minh',
   'Thành phố Hồ Chí Minh',
   '66-68 Lê Thánh Tôn, Phường Sài Gòn, Thành phố Hồ Chí Minh',
   'ACTIVE',
   now());
