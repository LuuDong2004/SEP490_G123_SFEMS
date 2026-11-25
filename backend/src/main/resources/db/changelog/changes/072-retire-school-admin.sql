--liquibase formatted sql

--changeset qltb:072-retire-school-admin
-- Gộp vai SCHOOL_ADMIN vào SCHOOL_LEADER, và thu hồi quyền xem toàn bộ cơ quan
-- quản lý của hai vai trường.
--
-- Theo docs/phantich/00-actor-va-phan-quyen.md: A7 "Quản trị viên trường" đã
-- được gộp vào A6 "Lãnh đạo trường" — "quyền của lãnh đạo trường là HỢP của hai
-- vai trò cũ, không mất quyền nào". Vai SCHOOL_ADMIN trong database là tàn dư
-- của lần tách cũ; hiện không tài khoản nào mang nó, nên gỡ không ai mất gì.

-- ---------------------------------------------------------------- 1. Lỗi thứ bậc
-- Cán bộ trường đọc được CẢ 169 cơ quan quản lý, trong khi hiệu trưởng của
-- chính trường đó và chuyên viên UBND đều bị 403 — thứ bậc lộn ngược. Tàn dư
-- của lần chép hàng loạt quyền từ vai USER ở changelog 033; vai USER nay đã bị
-- gỡ nên chỉ còn dấu vết ở hai vai này.
--
-- `departments_of_education` KHÔNG nằm dưới phạm vi dòng, nên mã quyền này
-- nghĩa là "thấy hết" chứ không phải "thấy phần của mình". Trường không mất gì:
-- cơ quan quản lý của chính trường vẫn hiện trên hồ sơ trường dạng tóm tắt nhúng.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.code IN ('SCHOOL_STAFF', 'SCHOOL_ADMIN')
  AND p.code = 'departments_of_education:read';

-- ---------------------------------------------------------------- 2. Chuyển PHẠM VI DÒNG
-- Phải làm TRƯỚC khi cấp mã quyền, và không được quên: hiệu trưởng hiện chỉ có
-- chính sách `read` trên mọi tài nguyên. Cấp `staff:write` mà không có phạm vi
-- ghi thì `@PreAuthorize` cho qua rồi máy chủ vẫn từ chối từng dòng — quyền có
-- trên giấy mà bấm vào đâu cũng lỗi, kiểu hỏng khó chẩn đoán nhất.
--
-- Mọi tài nguyên ở đây đều thuộc trường và đã nằm dưới phạm vi dòng, nên điều
-- kiện chép nguyên vẹn vẫn bó hiệu trưởng vào đúng trường mình.
INSERT INTO row_level_policy (
    kind, role_id, resource, action, name, policy_group, description,
    scope, check_scope, enabled, created_at)
SELECT p.kind, leader.id, p.resource, p.action,
       p.name, p.policy_group,
       COALESCE(p.description, '') || ' (chuyển từ vai Quản trị trường đã gộp)',
       p.scope, p.check_scope, p.enabled, now()
FROM row_level_policy p
JOIN roles admin ON admin.id = p.role_id AND admin.code = 'SCHOOL_ADMIN'
CROSS JOIN roles leader
WHERE leader.code = 'SCHOOL_LEADER'
  AND NOT EXISTS (
      SELECT 1 FROM row_level_policy x
      WHERE x.role_id = leader.id AND x.resource = p.resource AND x.action = p.action);

-- ---------------------------------------------------------------- 3. Chuyển MÃ QUYỀN
-- Năm mã chỉ SCHOOL_ADMIN có. Không chuyển thì sau khi gỡ vai sẽ không ai sửa
-- được hồ sơ cán bộ: `staff:write` hiện chỉ tồn tại ở vai sắp gỡ.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'SCHOOL_LEADER'
  AND p.code IN ('staff:write', 'staff:delete', 'rooms:delete', 'buildings:delete', 'campuses:delete')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

-- ---------------------------------------------------------------- 4. KHÔNG chuyển ba mã này
-- `users:read`, `users:write`, `roles:read` ở lại với ADMIN.
--
-- Tài liệu nói lãnh đạo trường kiêm đầu mối quản trị, và điều đó đúng về nghiệp
-- vụ. Nhưng `users` và `roles` đứng NGOÀI phạm vi dòng (xem CLAUDE.md, mục Row-
-- level security: chúng nằm trong chính chuỗi phụ thuộc của authority cache),
-- nên `users:write` hôm nay nghĩa là sửa được MỌI tài khoản của mọi trường — kể
-- cả tự gán vai ADMIN cho mình. Cấp nó cho hiệu trưởng là dời lỗ hổng, không vá.
--
-- Việc phải làm trước: đưa `users` vào phạm vi dòng theo trường. Xong rồi mới
-- cấp `users:read`/`users:write` cho SCHOOL_LEADER bằng một changelog riêng.

-- ---------------------------------------------------------------- 5. Gỡ vai
-- Bảng nhật ký chính sách trỏ vào chính sách, và chính sách trỏ vào vai — dọn
-- từ trong ra ngoài, nếu không khoá ngoại RESTRICT sẽ chặn.
DELETE FROM row_level_policy_audit a
USING row_level_policy p, roles r
WHERE a.policy_id = p.id AND p.role_id = r.id AND r.code = 'SCHOOL_ADMIN';

DELETE FROM row_level_policy p
USING roles r
WHERE p.role_id = r.id AND r.code = 'SCHOOL_ADMIN';

DELETE FROM role_permissions rp
USING roles r
WHERE rp.role_id = r.id AND r.code = 'SCHOOL_ADMIN';

DELETE FROM roles WHERE code = 'SCHOOL_ADMIN';
