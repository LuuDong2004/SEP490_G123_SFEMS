--liquibase formatted sql

--changeset dth:013-seed-education-levels
--comment Mã quyền cho resource education_levels, phần cấp cho từng vai trò, và năm cấp học của hệ thống giáo dục phổ thông.

-- Cùng hình dạng "resource:action" như mọi thứ khác, nên access control
-- provider suy ra ba mã này từ tên resource trong routes.tsx đúng cách nó suy
-- ra phần còn lại -- xem 005-seed-security.sql.
--
-- system_permission đặt tường minh ở đây thay vì để 008 điền bù như với những
-- mã có trước nó: ba mã này đến trong cùng migration với các annotation
-- @PreAuthorize kiểm chúng, và đó đúng là ý nghĩa của cờ này.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('education_levels:read',   'Xem cấp học',        'Xem danh sách và chi tiết cấp học',  TRUE),
  ('education_levels:write',  'Sửa cấp học',        'Thêm và sửa cấp học',                TRUE),
  ('education_levels:delete', 'Xoá cấp học',        'Xoá vĩnh viễn một cấp học',          TRUE);

-- ADMIN nhận đủ ba. Phải viết ra tường minh: 005 đã cấp cho ADMIN mọi quyền
-- tồn tại VÀO LÚC NÓ CHẠY, mà đó là một phép join trên bảng chưa có ba dòng
-- này. Một mã quyền thêm về sau không thuộc về ai cho tới khi có migration nói
-- điều đó.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'education_levels:read', 'education_levels:write', 'education_levels:delete')
WHERE r.code = 'ADMIN';

-- MANAGER (vai Sở) duy trì danh mục dùng chung nhưng không xoá: danh mục là
-- dữ liệu tham chiếu mà các bản ghi khác trỏ vào, nên "ngưng dùng" bằng cờ
-- active mới là thao tác đúng, còn xoá là việc của quản trị hệ thống và chỉ
-- dành cho những mục vừa tạo nhầm.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('education_levels:read', 'education_levels:write')
WHERE r.code = 'MANAGER';

-- USER chỉ đọc, và phải có quyền đọc: cấp học là thứ xuất hiện trong ô chọn
-- của màn trường học. Không có mã này thì ô chọn đó rỗng mà không có lỗi nào.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'education_levels:read'
WHERE r.code = 'USER';

-- Ba cấp học phổ thông. Đây là dữ liệu tham chiếu có thật chứ không phải dữ
-- liệu demo: nó không thay đổi theo từng lần triển khai và mọi trường đều
-- dùng chung.
--
-- Mầm non và Giáo dục thường xuyên CỐ Ý không có: hệ thống này quản lý cơ sở
-- vật chất của khối phổ thông. Cần thêm thì đó là một dòng thêm trên màn danh
-- mục, không phải một lần sửa mã nguồn.
--
-- sort_order theo trình tự học chứ không theo bảng chữ cái, vì đó là trật tự
-- tự nhiên mà tên không nói lên được.
--
-- created_by_id để NULL: migration không có ai đăng nhập, và BaseEntity đọc
-- người tạo từ SecurityContextHolder nên nó cũng sẽ là NULL trên đường đi của
-- ứng dụng khi không có caller. Cột nullable là câu trả lời đúng, không phải
-- một tài khoản "hệ thống" giả.
INSERT INTO education_levels (code, name, short_name, sort_order, active, created_at) VALUES
  ('TH',   'Tiểu học',            'TH',   10, TRUE, now()),
  ('THCS', 'Trung học cơ sở',     'THCS', 20, TRUE, now()),
  ('THPT', 'Trung học phổ thông', 'THPT', 30, TRUE, now());
