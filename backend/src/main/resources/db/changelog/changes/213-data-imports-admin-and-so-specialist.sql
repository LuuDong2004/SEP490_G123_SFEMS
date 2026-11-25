--liquibase formatted sql

--changeset qltb:213-data-imports-admin-and-so-specialist
-- Nhập dữ liệu đầu vào chỉ còn ADMIN (nhà thầu) và Chuyên viên Sở (theo trưởng nhóm, 11/11/2026).
--
-- 1. Gỡ `data_imports:*` khỏi Lãnh đạo trường (`146`) và Cán bộ thiết bị (`156`). Lô cũ của trường vẫn nằm
--    trong bảng, ADMIN / Sở thấy và xử lý được.
-- 2. Cấp `data_imports:*` cho Chuyên viên Sở.
-- 3. Lúc Ghi, lô đi qua service của từng loại và bị kiểm phạm vi GHI từng dòng (`checkWritable`). Chuyên viên Sở
--    chỉ có phạm vi đọc trên dữ liệu trường, và phạm vi ghi `schools` chỉ là trường Sở chủ quản (`043`) — cấp
--    mã quyền mà quên phần này thì màn mở được mà bấm Ghi là 422. Nên cấp KÈM phạm vi ghi toàn thành phố
--    (`{"all": []}`, như ADMIN) trên đúng các bảng lô nhập ghi vào: cơ sở, khối nhà, phòng, cán bộ, lớp, tổ bộ
--    môn, thiết bị, và `schools` (lô "Danh sách trường" ghi cả trường do UBND quản lý).
--    Hệ quả có chủ ý: Chuyên viên Sở cũng sửa tay được các bảng này ở màn thường.
--    Hoàn tác lô xoá thẳng bằng JDBC nên không cần quyền / phạm vi `delete`.

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.code IN ('SCHOOL_LEADER', 'SCHOOL_STAFF')
  AND p.code IN ('data_imports:read', 'data_imports:write', 'data_imports:delete');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('data_imports:read', 'data_imports:write', 'data_imports:delete',
                                 'campuses:write', 'buildings:write', 'rooms:write', 'staff:write',
                                 'school_classes:write', 'subject_teams:write', 'equipment:write', 'schools:write')
WHERE r.code = 'SO_SPECIALIST'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

-- Phạm vi đọc + ghi toàn thành phố. SCOPE gộp OR giữa các chính sách của vai, nên thêm `all` mở rộng phạm vi ghi
-- `schools` hiện có (trường Sở chủ quản) thành mọi trường mà không cần xoá chính sách cũ.
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, res.resource, a.action,
       'Sở nhập dữ liệu đầu vào mọi trường',
       'Chuyên viên Sở nhập dữ liệu đầu vào (cơ sở, phòng, cán bộ, lớp, thiết bị, danh sách trường) cho mọi trường.',
       '{"all": []}'::jsonb, now()
FROM roles r
CROSS JOIN (VALUES ('campuses'), ('buildings'), ('rooms'), ('staff'), ('school_classes'), ('subject_teams'),
                   ('equipment'), ('schools')) AS res(resource)
CROSS JOIN (VALUES ('read'), ('write')) AS a(action)
WHERE r.code = 'SO_SPECIALIST'
  AND NOT EXISTS (SELECT 1 FROM row_level_policy x
                  WHERE x.role_id = r.id AND x.resource = res.resource AND x.action = a.action
                    AND x.scope = '{"all": []}'::jsonb);

--rollback DELETE FROM row_level_policy_audit WHERE policy_id IN (SELECT p.id FROM row_level_policy p JOIN roles r ON r.id = p.role_id WHERE r.code = 'SO_SPECIALIST' AND p.name = 'Sở nhập dữ liệu đầu vào mọi trường');
--rollback DELETE FROM row_level_policy p USING roles r WHERE p.role_id = r.id AND r.code = 'SO_SPECIALIST' AND p.name = 'Sở nhập dữ liệu đầu vào mọi trường';
--rollback DELETE FROM role_permissions rp USING roles r, permissions p WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = 'SO_SPECIALIST' AND p.code IN ('data_imports:read', 'data_imports:write', 'data_imports:delete', 'campuses:write', 'buildings:write', 'rooms:write', 'staff:write', 'school_classes:write', 'subject_teams:write', 'equipment:write');
--rollback INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('data_imports:read', 'data_imports:write', 'data_imports:delete') WHERE r.code IN ('SCHOOL_LEADER', 'SCHOOL_STAFF') AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
