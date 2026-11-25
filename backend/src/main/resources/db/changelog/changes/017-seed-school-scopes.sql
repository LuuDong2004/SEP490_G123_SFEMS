--liquibase formatted sql

--changeset dth:017-seed-school-scopes
--comment Phạm vi dòng cho resource schools. BẮT BUỘC phải có, vì schools chạy trên defaultScope = NONE.

-- Nền dth-framework cố ý KHÔNG seed dòng chính sách nào: mọi resource của nó
-- chạy trên `defaultScope = FULL`, nên bật phân quyền dòng lên là một thao tác
-- không đổi gì và không cần seed để giữ nguyên hiện trạng.
--
-- `schools` thì ngược lại. Nó chạy trên `NONE` — vai trò không có phạm vi thì
-- KHÔNG thấy gì — nên không có ba dòng dưới đây thì màn Trường trống với tất
-- cả mọi người, kể cả quản trị viên, và mọi lần tạo trường đều bị 422 vì vế
-- WITH CHECK từ chối. Đó là hành vi ĐÚNG của `NONE`; seed là cách nói cho nó
-- biết ai được thấy gì.
--
-- Vì sao chọn `NONE` dù phải trả giá này: `FULL` có đúng hình dạng của cái bẫy
-- đã cắn ở bản Jmix. Ở đó `tenantId = NULL` nghĩa là "mọi người đều thấy"; ở
-- đây `FULL` nghĩa là "vai trò nào chưa ai viết chính sách cho thì không bị
-- giới hạn". Cả hai đều rò trong im lặng. Dưới `NONE`, quên chính sách là một
-- màn hình trống có người báo trong một giờ.

-- ADMIN: không giới hạn. `{"all": []}` là cây rỗng, và cây rỗng là phạm vi đầy
-- đủ — phải viết ra tường minh chứ không phải để trống, vì dưới NONE thì
-- "không có chính sách" nghĩa là "không thấy gì".
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, 'schools', a.action,
       'Quản trị hệ thống xem mọi trường',
       'Quản trị viên không bị giới hạn theo trường.',
       '{"all": []}'::jsonb, now()
FROM roles r
CROSS JOIN (VALUES ('read'), ('write'), ('delete')) AS a(action)
WHERE r.code = 'ADMIN';

-- MANAGER (vai Sở): cũng thấy mọi trường, vì Sở quản lý toàn bộ trường trực
-- thuộc. Không có dòng `delete` — vai trò này không được cấp `schools:delete`
-- ngay từ tầng mã quyền, nên một phạm vi xoá ở đây sẽ là luật chết.
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, 'schools', a.action,
       'Sở xem và sửa mọi trường',
       'Sở GD&ĐT quản lý toàn bộ trường trực thuộc.',
       '{"all": []}'::jsonb, now()
FROM roles r
CROSS JOIN (VALUES ('read'), ('write')) AS a(action)
WHERE r.code = 'MANAGER';

-- USER (cán bộ trường): CHỈ trường của chính mình.
--
-- Đây là luật mà cả trục tổ chức được dựng ra để phục vụ. `user.schoolId` đọc
-- từ `RowLevelPrincipal`, vốn được dựng từ entry của authority cache — không
-- tốn truy vấn nào.
--
-- Tài khoản chưa gắn trường thì `user.schoolId` là NULL, phép so sánh cho ra
-- UNKNOWN, và UNKNOWN bị xử như TỪ CHỐI. Nên họ không thấy gì — fail closed,
-- ngược hẳn với `tenantId = NULL` của bản Jmix nơi rỗng nghĩa là thấy tất cả.
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, 'schools', 'read',
       'Cán bộ chỉ xem trường của mình',
       'Chỉ thấy đúng trường mà tài khoản được gán.',
       '{"field": "id", "op": "eq", "value": {"ctx": "user.schoolId"}}'::jsonb, now()
FROM roles r
WHERE r.code = 'USER';
