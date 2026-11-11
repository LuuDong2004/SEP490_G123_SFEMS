--liquibase formatted sql

--changeset hoangpnd:052-quyen-co-quan-quan-ly
--comment Mã quyền cho resource departments_of_education (Cơ quan quản lý) và cấp cho các vai trò.
-- 006 đã seed schools, rooms, purchase_proposals, procurement_plans nhưng thiếu departments_of_education,
-- nên API cơ quan quản lý trả 403 với mọi tài khoản: form trường không chọn được cơ quan quản lý, danh sách
-- trường mất ô lọc "Mọi cơ quan quản lý", màn tài khoản không chọn được đơn vị.

INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('departments_of_education:read',   'Xem cơ quan quản lý',   'Xem danh sách và chi tiết cơ quan quản lý', TRUE),
  ('departments_of_education:write',  'Sửa cơ quan quản lý',   'Thêm và sửa cơ quan quản lý',               TRUE),
  ('departments_of_education:delete', 'Xoá cơ quan quản lý',   'Xoá vĩnh viễn một cơ quan quản lý',         TRUE)
ON CONFLICT (code) DO NOTHING;

-- Cả năm vai trò đều đọc: tên cơ quan quản lý hiện ở hồ sơ trường, danh sách trường, màn tài khoản và ô
-- chọn vai trò. Thiếu quyền đọc thì các ô đó rỗng mà không có lỗi nào.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.code IN ('departments_of_education:read')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Thêm, sửa, xoá: quản trị viên hệ thống. Danh sách cơ quan quản lý là danh mục nền của toàn ngành, không
-- phải dữ liệu của một trường; Sở và trường chỉ đọc để chọn.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
  AND p.code IN ('departments_of_education:write', 'departments_of_education:delete')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'departments_of_education:%');
--rollback DELETE FROM permissions WHERE code IN ('departments_of_education:read', 'departments_of_education:write', 'departments_of_education:delete');
