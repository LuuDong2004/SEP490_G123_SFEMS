--liquibase formatted sql

--changeset dth:043-seed-org-roles
--comment Chín vai trò mặc định theo cây quản lý Sở - UBND - Trường, kèm quyền và phạm vi dữ liệu.

-- Ba vai trò của 005 (ADMIN / MANAGER / USER) là vai trò của nền dth-framework:
-- đủ để đăng nhập thử, không mô tả được tổ chức thật. Cây quản lý thật là:
--
--     Sở GD&ĐT ──trực tiếp──► THPT
--         └────qua UBND─────► UBND phường/xã ──► Tiểu học · THCS
--
-- Mỗi phía quản lý cần MỘT CẶP lãnh đạo — chuyên viên, và cặp đó là điều kiện
-- để bước phê duyệt có nghĩa: gộp lại thì người lập phiếu cũng là người duyệt
-- phiếu.
--
-- Vai trò ở đây là DỮ LIỆU, không phải hằng số trong mã nguồn (Chương V mục
-- 3.6.3 và 2.2.11). Chín dòng dưới đây là điểm khởi đầu để đào tạo (mục 3.14)
-- và để kiểm thử phân quyền (mục 3.12) — không phải giới hạn. Sở sửa được.

-- ---------------------------------------------------------------- 1. Vai trò
INSERT INTO roles (code, name, description, system_role) VALUES
  ('SO_LEADER',       'Lãnh đạo Sở',
   'Giám đốc, Phó Giám đốc. Xem toàn thành phố, phê duyệt ở cấp Sở.', TRUE),
  ('SO_SPECIALIST',   'Chuyên viên Sở (CSVC - Thiết bị)',
   'Danh mục chuẩn theo Thông tư, tổng hợp toàn thành phố, kế hoạch mua sắm.', TRUE),
  ('UBND_LEADER',     'Lãnh đạo UBND phụ trách giáo dục',
   'Phê duyệt chứng từ và kế hoạch của trường Tiểu học, THCS trên địa bàn.', TRUE),
  ('UBND_SPECIALIST', 'Chuyên viên UBND (CSVC - Thiết bị)',
   'Theo dõi, tổng hợp và trình duyệt cho trường Tiểu học, THCS trên địa bàn.', TRUE),
  ('SCHOOL_LEADER',   'Lãnh đạo trường',
   'Hiệu trưởng, Hiệu phó. Phê duyệt chứng từ trong trường.', TRUE),
  ('TEACHER',         'Giáo viên - Người sử dụng',
   'Tra cứu thiết bị, mượn - trả, báo hỏng.', TRUE);

-- Hai vai trò phía trường ĐÃ TỒN TẠI từ migration 033 — không tạo lại.
--
--   SCHOOL_ADMIN      giữ nguyên tên và mã.
--   EQUIPMENT_OFFICER đổi mã thành SCHOOL_STAFF.
--
-- Đổi mã chứ không tạo một vai trò song song: "cán bộ thiết bị" và "cán bộ
-- CSVC - thiết bị" là cùng một người, và hai vai trò gần trùng nhau là thứ
-- người gán quyền sẽ chọn nhầm. Mã mới khớp với vốn từ của bộ tài liệu phân
-- tích, nên tài liệu và cơ sở dữ liệu nói cùng một thứ tiếng.
--
-- Không có nơi nào trong mã nguồn Java hay TypeScript nhắc tới mã cũ — nó chỉ
-- xuất hiện trong các migration đã chạy trước đó, vốn chạy xong từ lâu.
UPDATE roles
SET code = 'SCHOOL_STAFF',
    name = 'Cán bộ thiết bị - CSVC trường',
    description = 'Lập mọi loại phiếu, hồ sơ thiết bị, kiểm kê, bảo trì, nhu cầu. Dùng hệ thống hằng ngày.'
WHERE code = 'EQUIPMENT_OFFICER';

-- ---------------------------------------------------------------- 2. Quyền chức năng
--
-- Viết bằng một bảng (vai trò, mẫu mã quyền) rồi nối, thay vì liệt kê từng
-- cặp: mỗi dòng dưới đây đọc được thành một câu tiếng Việt, và thêm một tài
-- nguyên mới vào một nhóm không phải sửa chín chỗ.
--
-- LIKE '%:read' áp cho mọi tài nguyên là cố ý với vai trò cấp Sở: họ ĐỌC toàn
-- ngành. Cái hẹp lại là phạm vi DÒNG ở mục 3, không phải mã quyền.
WITH grant_map(role_code, pattern) AS (VALUES
  -- Lãnh đạo Sở: đọc và xuất mọi thứ, không sửa gì. Phê duyệt cấp Sở.
  ('SO_LEADER', '%:read'), ('SO_LEADER', '%:export'), ('SO_LEADER', 'equipment_intakes:approve'),

  -- Chuyên viên Sở: đọc và xuất mọi thứ; sửa danh mục dùng chung và trục tổ chức.
  ('SO_SPECIALIST', '%:read'), ('SO_SPECIALIST', '%:export'),
  ('SO_SPECIALIST', 'acquisition_methods:write'), ('SO_SPECIALIST', 'education_levels:write'),
  ('SO_SPECIALIST', 'equipment_catalogs:write'),  ('SO_SPECIALIST', 'equipment_configs:write'),
  ('SO_SPECIALIST', 'equipment_norms:write'),     ('SO_SPECIALIST', 'equipment_standards:write'),
  ('SO_SPECIALIST', 'equipment_types:write'),     ('SO_SPECIALIST', 'grades:write'),
  ('SO_SPECIALIST', 'movement_reasons:write'),    ('SO_SPECIALIST', 'origin_sources:write'),
  ('SO_SPECIALIST', 'room_types:write'),          ('SO_SPECIALIST', 'school_years:write'),
  ('SO_SPECIALIST', 'semesters:write'),           ('SO_SPECIALIST', 'subject_groups:write'),
  ('SO_SPECIALIST', 'subjects:write'),            ('SO_SPECIALIST', 'units:write'),
  ('SO_SPECIALIST', 'wards:write'),
  ('SO_SPECIALIST', 'departments_of_education:write'), ('SO_SPECIALIST', 'schools:write'),

  -- Lãnh đạo UBND: đọc và xuất phần nghiệp vụ; phê duyệt phiếu của trường trên địa bàn.
  ('UBND_LEADER', 'schools:read'),  ('UBND_LEADER', 'schools:export'),
  ('UBND_LEADER', 'staff:read'),    ('UBND_LEADER', 'campuses:read'),
  ('UBND_LEADER', 'buildings:read'),('UBND_LEADER', 'rooms:read'),
  ('UBND_LEADER', 'equipment:read'),('UBND_LEADER', 'equipment:export'),
  ('UBND_LEADER', 'equipment_stock:read'),
  ('UBND_LEADER', 'equipment_intakes:read'), ('UBND_LEADER', 'equipment_intakes:export'),
  ('UBND_LEADER', 'equipment_intakes:approve'),
  ('UBND_LEADER', 'equipment_types:read'),   ('UBND_LEADER', 'equipment_catalogs:read'),
  ('UBND_LEADER', 'education_levels:read'),  ('UBND_LEADER', 'wards:read'),

  -- Chuyên viên UBND: như lãnh đạo nhưng KHÔNG phê duyệt.
  ('UBND_SPECIALIST', 'schools:read'),  ('UBND_SPECIALIST', 'schools:export'),
  ('UBND_SPECIALIST', 'staff:read'),    ('UBND_SPECIALIST', 'campuses:read'),
  ('UBND_SPECIALIST', 'buildings:read'),('UBND_SPECIALIST', 'rooms:read'),
  ('UBND_SPECIALIST', 'equipment:read'),('UBND_SPECIALIST', 'equipment:export'),
  ('UBND_SPECIALIST', 'equipment_stock:read'),
  ('UBND_SPECIALIST', 'equipment_intakes:read'), ('UBND_SPECIALIST', 'equipment_intakes:export'),
  ('UBND_SPECIALIST', 'equipment_types:read'),   ('UBND_SPECIALIST', 'equipment_catalogs:read'),
  ('UBND_SPECIALIST', 'education_levels:read'),  ('UBND_SPECIALIST', 'wards:read'),

  -- Lãnh đạo trường: đọc và xuất trong trường, phê duyệt phiếu của trường.
  ('SCHOOL_LEADER', 'schools:read'),   ('SCHOOL_LEADER', 'staff:read'),
  ('SCHOOL_LEADER', 'campuses:read'),  ('SCHOOL_LEADER', 'buildings:read'),
  ('SCHOOL_LEADER', 'rooms:read'),     ('SCHOOL_LEADER', 'rooms:export'),
  ('SCHOOL_LEADER', 'equipment:read'), ('SCHOOL_LEADER', 'equipment:export'),
  ('SCHOOL_LEADER', 'equipment_stock:read'),
  ('SCHOOL_LEADER', 'equipment_intakes:read'), ('SCHOOL_LEADER', 'equipment_intakes:export'),
  ('SCHOOL_LEADER', 'equipment_intakes:approve'),
  ('SCHOOL_LEADER', 'equipment_types:read'),   ('SCHOOL_LEADER', 'equipment_catalogs:read'),

  -- Quản trị viên trường: tài khoản trong trường + khai báo cơ sở vật chất.
  ('SCHOOL_ADMIN', 'users:read'),  ('SCHOOL_ADMIN', 'users:write'),
  ('SCHOOL_ADMIN', 'roles:read'),
  ('SCHOOL_ADMIN', 'schools:read'),
  ('SCHOOL_ADMIN', 'staff:read'),     ('SCHOOL_ADMIN', 'staff:write'),
  ('SCHOOL_ADMIN', 'campuses:read'),  ('SCHOOL_ADMIN', 'campuses:write'),
  ('SCHOOL_ADMIN', 'buildings:read'), ('SCHOOL_ADMIN', 'buildings:write'),
  ('SCHOOL_ADMIN', 'rooms:read'),     ('SCHOOL_ADMIN', 'rooms:write'),
  ('SCHOOL_ADMIN', 'room_types:read'),('SCHOOL_ADMIN', 'education_levels:read'),

  -- Cán bộ thiết bị: người làm việc hằng ngày. Ghi trên cơ sở vật chất và thiết bị.
  ('SCHOOL_STAFF', 'schools:read'),    ('SCHOOL_STAFF', 'staff:read'),
  ('SCHOOL_STAFF', 'campuses:read'),   ('SCHOOL_STAFF', 'buildings:read'),
  ('SCHOOL_STAFF', 'rooms:read'),      ('SCHOOL_STAFF', 'rooms:write'),
  ('SCHOOL_STAFF', 'rooms:export'),
  ('SCHOOL_STAFF', 'equipment:read'),  ('SCHOOL_STAFF', 'equipment:write'),
  ('SCHOOL_STAFF', 'equipment:delete'),('SCHOOL_STAFF', 'equipment:export'),
  ('SCHOOL_STAFF', 'equipment_stock:read'),
  ('SCHOOL_STAFF', 'equipment_intakes:read'),  ('SCHOOL_STAFF', 'equipment_intakes:write'),
  ('SCHOOL_STAFF', 'equipment_intakes:delete'),('SCHOOL_STAFF', 'equipment_intakes:export'),
  -- Xác nhận nhận hàng là một hành động `approve`, và cán bộ thiết bị là người
  -- đứng nhận hàng. Ai DUYỆT phiếu thì do bước duyệt quyết định, không phải
  -- bước xác nhận.
  ('SCHOOL_STAFF', 'equipment_intakes:approve'),
  ('SCHOOL_STAFF', 'equipment_types:read'),    ('SCHOOL_STAFF', 'equipment_catalogs:read'),
  ('SCHOOL_STAFF', 'equipment_configs:read'),  ('SCHOOL_STAFF', 'equipment_standards:read'),
  ('SCHOOL_STAFF', 'equipment_norms:read'),    ('SCHOOL_STAFF', 'acquisition_methods:read'),
  ('SCHOOL_STAFF', 'origin_sources:read'),     ('SCHOOL_STAFF', 'movement_reasons:read'),
  ('SCHOOL_STAFF', 'units:read'),              ('SCHOOL_STAFF', 'room_types:read'),
  ('SCHOOL_STAFF', 'school_years:read'),       ('SCHOOL_STAFF', 'semesters:read'),
  ('SCHOOL_STAFF', 'subjects:read'),           ('SCHOOL_STAFF', 'subject_groups:read'),
  ('SCHOOL_STAFF', 'grades:read'),             ('SCHOOL_STAFF', 'education_levels:read'),

  -- Giáo viên: chỉ tra cứu. Mượn - trả và báo hỏng do cán bộ thiết bị ghi nhận
  -- (xem docs/phantich, sheet "Tai khoan": hạn mức 5.170 tài khoản không đủ để
  -- mọi giáo viên có tài khoản riêng).
  ('TEACHER', 'schools:read'),   ('TEACHER', 'rooms:read'),
  ('TEACHER', 'equipment:read'), ('TEACHER', 'equipment_types:read'),
  ('TEACHER', 'equipment_catalogs:read')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, p.id
FROM grant_map g
JOIN roles r ON r.code = g.role_code
JOIN permissions p ON p.code LIKE g.pattern
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Thông báo là của chính mình, nên mọi vai trò đều có. Một tài khoản không đọc
-- được thông báo của chính nó thì đơn giản là không bao giờ được báo gì.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('SO_LEADER', 'SO_SPECIALIST', 'UBND_LEADER', 'UBND_SPECIALIST',
                 'SCHOOL_LEADER', 'SCHOOL_ADMIN', 'SCHOOL_STAFF', 'TEACHER')
  AND p.code IN ('notifications:read', 'notifications:delete')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ---------------------------------------------------------------- 3. Phạm vi dữ liệu
--
-- `schools` chạy trên defaultScope = NONE: vai trò không có phạm vi thì KHÔNG
-- thấy dòng nào. Tám vai trò vừa tạo mà không có mục này thì màn Trường trống
-- với tất cả họ.
--
-- Đây là chỗ "Sở quản lý THÔNG QUA UBND" hiện ra thành luật chạy được.

-- Sở: ĐỌC toàn thành phố. Cây rỗng `{"all": []}` là phạm vi đầy đủ.
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, 'schools', 'read',
       'Sở xem mọi trường',
       'Sở GD&ĐT theo dõi toàn ngành, kể cả trường do UBND quản lý.',
       '{"all": []}'::jsonb, now()
FROM roles r
WHERE r.code IN ('SO_LEADER', 'SO_SPECIALIST')
  AND NOT EXISTS (
      SELECT 1 FROM row_level_policy p
      WHERE p.role_id = r.id AND p.resource = 'schools' AND p.action = 'read');

-- Sở: GHI chỉ trường mà chính Sở là cơ quan chủ quản.
--
-- Đây là vế thứ hai của "quản lý thông qua": Sở nhìn thấy trường Tiểu học và
-- THCS nhưng không sửa thay UBND. Nếu sau này Sở được sửa cả, sửa đúng một
-- dòng này thành `{"all": []}` — không đụng tới mã nguồn.
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, 'schools', 'write',
       'Sở sửa trường trực thuộc Sở',
       'Chỉ trường mà cơ quan chủ quản là chính Sở này. Trường Tiểu học, THCS do UBND sửa.',
       '{"field": "departmentOfEducation.id", "op": "eq", "value": {"ctx": "user.managingBodyId"}}'::jsonb,
       now()
FROM roles r
WHERE r.code = 'SO_SPECIALIST';

-- UBND: đọc và ghi đúng những trường mình là cơ quan chủ quản.
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, 'schools', a.action,
       'UBND quản lý trường trên địa bàn',
       'Chỉ trường mà cơ quan chủ quản là UBND này — thường là Tiểu học và THCS.',
       '{"field": "departmentOfEducation.id", "op": "eq", "value": {"ctx": "user.managingBodyId"}}'::jsonb,
       now()
FROM roles r
CROSS JOIN (VALUES ('read'), ('write')) AS a(action)
WHERE r.code IN ('UBND_LEADER', 'UBND_SPECIALIST')
  -- Chuyên viên không được cấp `schools:write` ở tầng mã quyền, nên phạm vi
  -- ghi của họ sẽ là luật chết. Chỉ lãnh đạo mới có vế `write`.
  AND NOT (r.code = 'UBND_SPECIALIST' AND a.action = 'write');

-- Trường: chỉ trường của chính mình.
--
-- Tài khoản chưa gắn trường thì `user.schoolId` là NULL, phép so sánh ra
-- UNKNOWN, và UNKNOWN bị xử như TỪ CHỐI — fail closed.
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, 'schools', 'read',
       'Cán bộ trường chỉ xem trường của mình',
       'Chỉ thấy đúng trường mà tài khoản được gán.',
       '{"field": "id", "op": "eq", "value": {"ctx": "user.schoolId"}}'::jsonb, now()
FROM roles r
WHERE r.code IN ('SCHOOL_LEADER', 'SCHOOL_ADMIN', 'SCHOOL_STAFF', 'TEACHER')
  -- SCHOOL_ADMIN và SCHOOL_STAFF đã có đúng phạm vi này từ migration 033.
  AND NOT EXISTS (
      SELECT 1 FROM row_level_policy p
      WHERE p.role_id = r.id AND p.resource = 'schools' AND p.action = 'read');

-- Quản trị viên trường sửa được hồ sơ trường mình (logo, màu nhận diện).
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, 'schools', 'write',
       'Quản trị viên trường sửa trường của mình',
       'Chỉ hồ sơ của đúng trường được gán.',
       '{"field": "id", "op": "eq", "value": {"ctx": "user.schoolId"}}'::jsonb, now()
FROM roles r
WHERE r.code = 'SCHOOL_ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM row_level_policy p
      WHERE p.role_id = r.id AND p.resource = 'schools' AND p.action = 'write');

-- ---------------------------------------------------------------- 4. Dọn vai trò cũ
--
-- MANAGER và USER là vai trò thử nghiệm của nền, giờ đã có vai trò thật thay
-- thế. Chuyển tài khoản đang giữ chúng sang vai trò tương đương trước, vì khoá
-- ngoại `user_roles` là RESTRICT — và vì im lặng tước quyền của ai đó là cách
-- hỏng tệ nhất.
INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, r_new.id
FROM user_roles ur
JOIN roles r_old ON r_old.id = ur.role_id AND r_old.code = 'MANAGER'
JOIN roles r_new ON r_new.code = 'SO_SPECIALIST'
WHERE NOT EXISTS (
    SELECT 1 FROM user_roles x WHERE x.user_id = ur.user_id AND x.role_id = r_new.id);

INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, r_new.id
FROM user_roles ur
JOIN roles r_old ON r_old.id = ur.role_id AND r_old.code = 'USER'
JOIN roles r_new ON r_new.code = 'TEACHER'
WHERE NOT EXISTS (
    SELECT 1 FROM user_roles x WHERE x.user_id = ur.user_id AND x.role_id = r_new.id);

DELETE FROM user_roles
WHERE role_id IN (SELECT id FROM roles WHERE code IN ('MANAGER', 'USER'));

DELETE FROM row_level_policy
WHERE role_id IN (SELECT id FROM roles WHERE code IN ('MANAGER', 'USER'));

DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE code IN ('MANAGER', 'USER'));

DELETE FROM roles WHERE code IN ('MANAGER', 'USER');
