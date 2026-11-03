--liquibase formatted sql

--changeset luudong:012-seed-du-lieu-mau
--comment Dữ liệu mẫu để mọi người chạy và nối được với nhau ngay: Sở GD&ĐT, ba trường THPT, tài khoản cho năm vai trò, danh mục thiết bị, định mức, phòng, hồ sơ thiết bị, phiếu nhập đã ghi tăng, đề xuất mua sắm và phiếu kiểm kê ở các trạng thái khác nhau. Nối theo mã, không ghi cứng id; đã có thì bỏ qua để chạy được trên máy đã tự nhập.

-- Mọi tài khoản mẫu dùng mật khẩu Admin@123 (cùng BCrypt với 'admin' ở changelog 005). Mật khẩu này
-- công khai: DemoAccountGuard khoá các tài khoản còn mật khẩu seed khi chạy bản chính thức.

-- ---------------------------------------------------------------- 1. Sở và ba trường THPT
INSERT INTO departments_of_education (code, name, province, address, type, status, created_at)
SELECT 'SO_GDDT_HCM', 'Sở Giáo dục và Đào tạo TP. Hồ Chí Minh', 'TP. Hồ Chí Minh',
       '66-68 Lê Thánh Tôn, Phường Sài Gòn, TP. Hồ Chí Minh', 'SO', 'ACTIVE', now()
WHERE NOT EXISTS (SELECT 1 FROM departments_of_education WHERE code = 'SO_GDDT_HCM');

INSERT INTO schools (department_of_education_id, education_level_id, code, short_code, name, address,
                     district, status, class_count, student_count, created_at)
SELECT d.id, el.id, s.code, s.short_code, s.name, s.address, s.district, 'ACTIVE', s.classes, s.students, now()
FROM (VALUES
    ('THPT_NGUYEN_THI_MINH_KHAI', 'MK', 'THPT Nguyễn Thị Minh Khai', '275 Điện Biên Phủ, Phường Xuân Hoà',  'Quận 3',   45, 2010),
    ('THPT_LE_QUY_DON',           'LQ', 'THPT Lê Quý Đôn',           '110 Nguyễn Thị Minh Khai, Phường Bến Thành', 'Quận 3', 42, 1890),
    ('THPT_BUI_THI_XUAN',         'BX', 'THPT Bùi Thị Xuân',         '73 Bùi Thị Xuân, Phường Bến Thành', 'Quận 1',   40, 1750)
) AS s(code, short_code, name, address, district, classes, students)
JOIN departments_of_education d ON d.code = 'SO_GDDT_HCM'
LEFT JOIN education_levels el ON el.code = 'THPT'
WHERE NOT EXISTS (SELECT 1 FROM schools x WHERE x.code = s.code);

-- ---------------------------------------------------------------- 2. Tài khoản cho năm vai trò
INSERT INTO users (username, email, password_hash, full_name, status, created_at, school_id, managing_body_id)
SELECT u.username, u.email, '$2a$10$ff7CTQvwMv0Szb.qGXF3zeMUkV8Jjta52A6kYzGDeZY4YE2pyd.YS', u.full_name, 'ACTIVE', now(),
       (SELECT id FROM schools WHERE code = u.school_code),
       (SELECT id FROM departments_of_education WHERE code = u.body_code)
FROM (VALUES
    ('so.lanhdao',     'so.lanhdao@sfems.local',     'Trần Văn Lãnh Đạo',   NULL,                        'SO_GDDT_HCM'),
    ('so.chuyenvien',  'so.chuyenvien@sfems.local',  'Nguyễn Thị Chuyên Viên', NULL,                     'SO_GDDT_HCM'),
    ('mk.hieutruong',  'mk.hieutruong@sfems.local',  'Lê Thị Hiệu Trưởng',  'THPT_NGUYEN_THI_MINH_KHAI', NULL),
    ('mk.thietbi',     'mk.thietbi@sfems.local',     'Phạm Văn Thiết Bị',   'THPT_NGUYEN_THI_MINH_KHAI', NULL),
    ('lqd.hieutruong', 'lqd.hieutruong@sfems.local', 'Võ Văn Hiệu Trưởng',  'THPT_LE_QUY_DON',           NULL),
    ('lqd.thietbi',    'lqd.thietbi@sfems.local',    'Đặng Thị Thiết Bị',   'THPT_LE_QUY_DON',           NULL),
    ('btx.thietbi',    'btx.thietbi@sfems.local',    'Hoàng Văn Thiết Bị',  'THPT_BUI_THI_XUAN',         NULL)
) AS u(username, email, full_name, school_code, body_code)
WHERE NOT EXISTS (SELECT 1 FROM users x WHERE x.username = u.username);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM (VALUES
    ('so.lanhdao',     'SO_LEADER'),
    ('so.chuyenvien',  'SO_SPECIALIST'),
    ('mk.hieutruong',  'SCHOOL_LEADER'),
    ('mk.thietbi',     'SCHOOL_STAFF'),
    ('lqd.hieutruong', 'SCHOOL_LEADER'),
    ('lqd.thietbi',    'SCHOOL_STAFF'),
    ('btx.thietbi',    'SCHOOL_STAFF')
) AS m(username, role_code)
JOIN users u ON u.username = m.username
JOIN roles r ON r.code = m.role_code
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

-- ---------------------------------------------------------------- 3. Danh mục thiết bị (DM-02)
--
-- Mã nội bộ do ta đặt. Môn 'DUNGCHUNG' là thiết bị dùng chung mọi môn (031).
INSERT INTO equipment_catalogs (code, name, sort_order, active, equipment_type_id, subject_id, education_level_id,
                                unit_id, tracking_type, useful_life_years, minimum_required, asset_category,
                                physical_or_digital, used_by_teacher, used_by_student, legal_basis, created_at)
SELECT v.code, v.name, v.sort_order, TRUE,
       (SELECT id FROM equipment_types WHERE code = v.type_code),
       (SELECT id FROM subjects WHERE code = v.subject_code),
       (SELECT id FROM education_levels WHERE code = 'THPT'),
       (SELECT id FROM units WHERE code = v.unit_code),
       v.tracking, v.life, v.minimum, v.category, v.pod, v.teacher, v.student,
       CASE WHEN v.minimum THEN 'Thông tư 39/2021/TT-BGDĐT' END, now()
FROM (VALUES
    ('MAYCHIEU',      'Máy chiếu đa năng',                   10, 'TBDC',    'DUNGCHUNG', 'CHIEC', 'SERIAL', 5,  TRUE,  'FIXED_ASSET',  'PHYSICAL', TRUE,  FALSE),
    ('MANCHIEU',      'Màn chiếu treo tường',                20, 'TBDC',    'DUNGCHUNG', 'CAI',   'SERIAL', 5,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  FALSE),
    ('TIVI65',        'Ti vi thông minh 65 inch',            30, 'TBDC',    'DUNGCHUNG', 'CHIEC', 'SERIAL', 6,  TRUE,  'FIXED_ASSET',  'PHYSICAL', TRUE,  TRUE),
    ('MAYTINHBAN',    'Máy tính để bàn',                     40, 'TBDC',    'TINHOC',    'BO',    'SERIAL', 5,  TRUE,  'FIXED_ASSET',  'PHYSICAL', TRUE,  TRUE),
    ('LAPTOP',        'Máy tính xách tay',                   50, 'MAYMOC',  'DUNGCHUNG', 'CHIEC', 'SERIAL', 5,  FALSE, 'FIXED_ASSET',  'PHYSICAL', TRUE,  FALSE),
    ('MAYIN',         'Máy in laser',                        60, 'MAYMOC',  'DUNGCHUNG', 'CHIEC', 'SERIAL', 5,  FALSE, 'DURABLE_TOOL', 'PHYSICAL', TRUE,  FALSE),
    ('LOAAMLY',       'Bộ loa, âm ly phòng học',             70, 'TBDC',    'DUNGCHUNG', 'BO',    'SERIAL', 5,  FALSE, 'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('BANGTUONGTAC',  'Bảng tương tác thông minh',           80, 'TBDH',    'DUNGCHUNG', 'BO',    'SERIAL', 6,  FALSE, 'FIXED_ASSET',  'PHYSICAL', TRUE,  TRUE),
    ('KINHHIENVI',    'Kính hiển vi quang học',              90, 'TBDH',    'SINHHOC',   'CHIEC', 'SERIAL', 8,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('BOTN_DIEN',     'Bộ thí nghiệm điện học',             100, 'TBDH',    'VATLI',     'BO',    'SERIAL', 5,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('BOTN_COHOC',    'Bộ thí nghiệm cơ học',               110, 'TBDH',    'VATLI',     'BO',    'SERIAL', 5,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('BOTN_QUANG',    'Bộ thí nghiệm quang học',            120, 'TBDH',    'VATLI',     'BO',    'SERIAL', 5,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('CANDIENTU',     'Cân điện tử phòng thí nghiệm',       130, 'TBDH',    'HOAHOC',    'CHIEC', 'SERIAL', 6,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('TUHUTKHI',      'Tủ hút khí độc',                     140, 'TBDH',    'HOAHOC',    'CAI',   'SERIAL', 10, TRUE,  'FIXED_ASSET',  'PHYSICAL', TRUE,  FALSE),
    ('MOHINHADN',     'Mô hình cấu trúc ADN',               150, 'TBDH',    'SINHHOC',   'BO',    'SERIAL', 6,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('QUADIACAU',     'Quả địa cầu',                        160, 'TBDH',    'DIALI',     'CAI',   'SERIAL', 6,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('BANDOVN',       'Bản đồ hành chính Việt Nam',         170, 'TBDH',    'DIALI',     'TO',    'BULK',   3,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('ONGNGHIEM',     'Ống nghiệm thuỷ tinh',               180, 'VATTU',   'HOAHOC',    'HOP',   'BULK',   2,  TRUE,  'SUPPLY',       'PHYSICAL', TRUE,  TRUE),
    ('BANGHEHS',      'Bộ bàn ghế học sinh',                190, 'DODUNG',  'DUNGCHUNG', 'BO',    'SERIAL', 8,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', FALSE, TRUE),
    ('PM_MOPHONG_VL', 'Phần mềm mô phỏng thí nghiệm Vật lí', 200, 'TBDH',   'VATLI',     'BO',    'SERIAL', 3,  FALSE, 'FIXED_ASSET',  'DIGITAL',  TRUE,  TRUE)
) AS v(code, name, sort_order, type_code, subject_code, unit_code, tracking, life, minimum, category, pod, teacher, student)
WHERE NOT EXISTS (SELECT 1 FROM equipment_catalogs c WHERE c.code = v.code);

-- ---------------------------------------------------------------- 4. Danh mục tối thiểu và định mức (DM-03)
INSERT INTO equipment_standards (code, name, sort_order, active, note, education_level_id, start_school_year_id,
                                 standard_version, status, created_at)
SELECT 'TT39-2021-THPT', 'Danh mục thiết bị dạy học tối thiểu cấp THPT', 10, TRUE,
       'Ban hành kèm Thông tư 39/2021/TT-BGDĐT ngày 30/12/2021. Dữ liệu mẫu, chỉ vài dòng.',
       (SELECT id FROM education_levels WHERE code = 'THPT'),
       (SELECT id FROM school_years WHERE code = '2024-2025'),
       '39/2021/TT-BGDĐT', 'ACTIVE', now()
WHERE NOT EXISTS (SELECT 1 FROM equipment_standards WHERE code = 'TT39-2021-THPT');

INSERT INTO equipment_norms (code, name, sort_order, active, standard_id, catalog_id, equipment_type_id, subject_id,
                             room_type_id, min_quantity, basis_size, unit_id, norm_basis, item_no, topic,
                             for_teacher, for_student, optional, created_at)
SELECT v.code, c.name, v.sort_order, TRUE, s.id, c.id, c.equipment_type_id, c.subject_id,
       (SELECT id FROM room_types WHERE code = v.room_type_code),
       v.min_quantity, v.basis_size, c.unit_id, v.basis, v.item_no, v.topic, c.used_by_teacher, c.used_by_student, FALSE, now()
FROM (VALUES
    ('TT39-DC-01', 'MAYCHIEU',   10, 1, 1,    NULL,        'PER_CLASS',  'I.1',  'Thiết bị dùng chung'),
    ('TT39-DC-02', 'MANCHIEU',   20, 1, 1,    NULL,        'PER_CLASS',  'I.2',  'Thiết bị dùng chung'),
    ('TT39-DC-03', 'BANGHEHS',   30, 1, 1,    NULL,        'PER_STUDENT', 'I.3', 'Thiết bị dùng chung'),
    ('TT39-TH-01', 'MAYTINHBAN', 40, 1, 2,    'MAYTINH',   'PER_STUDENT', 'II.1', 'Tin học'),
    ('TT39-VL-01', 'BOTN_DIEN',  50, 6, 1,    'BOMON',     'PER_ROOM',   'III.1', 'Vật lí – Điện học'),
    ('TT39-VL-02', 'BOTN_COHOC', 60, 6, 1,    'BOMON',     'PER_ROOM',   'III.2', 'Vật lí – Cơ học'),
    ('TT39-VL-03', 'BOTN_QUANG', 70, 6, 1,    'BOMON',     'PER_ROOM',   'III.3', 'Vật lí – Quang học'),
    ('TT39-HH-01', 'CANDIENTU',  80, 2, 1,    'BOMON',     'PER_ROOM',   'IV.1', 'Hoá học'),
    ('TT39-HH-02', 'TUHUTKHI',   90, 1, 1,    'BOMON',     'PER_ROOM',   'IV.2', 'Hoá học'),
    ('TT39-SH-01', 'KINHHIENVI', 100, 8, 1,   'BOMON',     'PER_ROOM',   'V.1',  'Sinh học'),
    ('TT39-SH-02', 'MOHINHADN',  110, 1, 1,   NULL,        'PER_SCHOOL', 'V.2',  'Sinh học'),
    ('TT39-DL-01', 'QUADIACAU',  120, 1, 1,   NULL,        'PER_SCHOOL', 'VI.1', 'Địa lí'),
    ('TT39-DL-02', 'BANDOVN',    130, 1, 1,   NULL,        'PER_SCHOOL', 'VI.2', 'Địa lí')
) AS v(code, catalog_code, sort_order, min_quantity, basis_size, room_type_code, basis, item_no, topic)
JOIN equipment_standards s ON s.code = 'TT39-2021-THPT'
JOIN equipment_catalogs c ON c.code = v.catalog_code
WHERE NOT EXISTS (SELECT 1 FROM equipment_norms n WHERE n.code = v.code);

-- ---------------------------------------------------------------- 5. Phòng của hai trường (TC-02)
INSERT INTO rooms (school_id, code, name, sort_order, active, room_type_id, subject_id, building, floor, capacity,
                   condition, usage_status, managing_unit, created_at)
SELECT s.id, r.code, r.name, r.sort_order, TRUE,
       (SELECT id FROM room_types WHERE code = r.type_code),
       (SELECT id FROM subjects WHERE code = r.subject_code),
       r.building, r.floor, r.capacity, 'TOT', 'DANG_SU_DUNG', r.unit, now()
FROM schools s
CROSS JOIN (VALUES
    ('KHO',    'Kho thiết bị',            10, 'KHO',       NULL,      'Dãy A', '1', NULL, 'Tổ Văn phòng'),
    ('P101',   'Phòng học 101',           20, 'PHONGHOC',  NULL,      'Dãy A', '1', 45,   NULL),
    ('P102',   'Phòng học 102',           30, 'PHONGHOC',  NULL,      'Dãy A', '1', 45,   NULL),
    ('P201',   'Phòng học 201',           40, 'PHONGHOC',  NULL,      'Dãy A', '2', 45,   NULL),
    ('P202',   'Phòng học 202',           50, 'PHONGHOC',  NULL,      'Dãy A', '2', 45,   NULL),
    ('BM-VL',  'Phòng bộ môn Vật lí',     60, 'BOMON',     'VATLI',   'Dãy B', '1', 40,   'Tổ Khoa học tự nhiên'),
    ('BM-HH',  'Phòng bộ môn Hoá học',    70, 'BOMON',     'HOAHOC',  'Dãy B', '1', 40,   'Tổ Khoa học tự nhiên'),
    ('BM-SH',  'Phòng bộ môn Sinh học',   80, 'BOMON',     'SINHHOC', 'Dãy B', '2', 40,   'Tổ Khoa học tự nhiên'),
    ('P-TIN1', 'Phòng máy tính 1',        90, 'MAYTINH',   'TINHOC',  'Dãy B', '2', 40,   'Tổ Toán – Tin'),
    ('TV',     'Thư viện',               100, 'THUVIEN',   NULL,      'Dãy C', '1', 80,   'Thư viện'),
    ('HT',     'Hội trường',             110, 'DANANG',    NULL,      'Dãy C', '2', 300,  'Tổ Văn phòng')
) AS r(code, name, sort_order, type_code, subject_code, building, floor, capacity, unit)
WHERE s.code IN ('THPT_NGUYEN_THI_MINH_KHAI', 'THPT_LE_QUY_DON')
  AND NOT EXISTS (SELECT 1 FROM rooms x WHERE x.school_id = s.id AND x.code = r.code);

-- Quy tắc mã của trường (TS-05): phòng P001…, phần ST của mã tài sản 3 chữ số từ 001.
INSERT INTO school_code_rules (school_id, target, prefix, number_length, start_number, created_at)
SELECT s.id, v.target, v.prefix, v.len, 1, now()
FROM schools s
CROSS JOIN (VALUES ('rooms', 'P', 3), ('equipment', NULL, 3)) AS v(target, prefix, len)
WHERE s.code IN ('THPT_NGUYEN_THI_MINH_KHAI', 'THPT_LE_QUY_DON')
  AND NOT EXISTS (SELECT 1 FROM school_code_rules x WHERE x.school_id = s.id AND x.target = v.target);

-- ---------------------------------------------------------------- 6. Một phiếu nhập đã ghi tăng (PN) của THPT Nguyễn Thị Minh Khai
--
-- Đi đúng đường hệ thống đi khi một phiếu nhập được duyệt: số phiếu từ document_number_sequences,
-- nhật ký SUBMIT → APPROVE → COMPLETE trong voucher_events, tài sản sinh ra trỏ về dòng phiếu, và một
-- dòng GHI_TANG trong equipment_history cho từng tài sản.
INSERT INTO document_number_sequences (school_id, prefix, current_number)
SELECT s.id, 'NK-2025', 1 FROM schools s WHERE s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
ON CONFLICT (school_id, prefix) DO NOTHING;

INSERT INTO equipment_intakes (school_id, code, status, approval_step, reached_step, submitted_at, submitted_by_id,
                               completed_at, completed_by_id, note, intake_date, document_no, document_date, supplier,
                               funding_source, origin_source_id, acquisition_method_id, school_year_id, warranty_months,
                               created_at, created_by_id)
SELECT s.id, 'NK-2025-00001', 'COMPLETED', NULL, 'SCHOOL',
       TIMESTAMP WITH TIME ZONE '2025-09-16 08:30:00+07', staff.id,
       TIMESTAMP WITH TIME ZONE '2025-09-16 14:05:00+07', leader.id,
       'Mua sắm đầu năm học 2025-2026 theo kế hoạch của Sở.',
       DATE '2025-09-15', 'HĐ-2025/087', DATE '2025-09-05', 'Công ty CP Thiết bị Giáo dục Sài Gòn',
       'STATE_BUDGET',
       (SELECT id FROM origin_sources WHERE code = 'NSNN'),
       (SELECT id FROM acquisition_methods WHERE code = 'MUASAM'),
       (SELECT id FROM school_years WHERE code = '2025-2026'),
       24, TIMESTAMP WITH TIME ZONE '2025-09-15 16:00:00+07', staff.id
FROM schools s
JOIN users staff ON staff.username = 'mk.thietbi'
JOIN users leader ON leader.username = 'mk.hieutruong'
WHERE s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
  AND NOT EXISTS (SELECT 1 FROM equipment_intakes x WHERE x.school_id = s.id AND x.code = 'NK-2025-00001');

INSERT INTO equipment_intake_lines (intake_id, line_no, catalog_id, name, physical_or_digital, asset_category,
                                    document_quantity, received_quantity, unit_price, room_id, generated_count,
                                    model, manufacturer, created_at)
SELECT i.id, l.line_no, c.id, c.name, 'PHYSICAL', c.asset_category, l.qty, l.qty, l.price,
       (SELECT id FROM rooms r WHERE r.school_id = i.school_id AND r.code = l.room_code),
       l.qty, l.model, l.maker, i.created_at
FROM equipment_intakes i
JOIN schools s ON s.id = i.school_id AND s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
CROSS JOIN (VALUES
    (1, 'MAYCHIEU',   4,  18500000, 'KHO',    'EB-X51',       'Epson'),
    (2, 'MAYTINHBAN', 10, 12300000, 'P-TIN1', 'Vostro 3910',  'Dell'),
    (3, 'BOTN_DIEN',  3,  8900000,  'BM-VL',  'VL-DH-2025',   'Thiết bị Giáo dục Sài Gòn')
) AS l(line_no, catalog_code, qty, price, room_code, model, maker)
JOIN equipment_catalogs c ON c.code = l.catalog_code
WHERE i.code = 'NK-2025-00001'
  AND NOT EXISTS (SELECT 1 FROM equipment_intake_lines x WHERE x.intake_id = i.id AND x.line_no = l.line_no);

INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, step, note, actor_id, actor_name, created_at)
SELECT 'equipment_intakes', i.id, e.action, e.from_status, e.to_status, e.step, e.note, u.id, u.full_name, e.at
FROM equipment_intakes i
JOIN schools s ON s.id = i.school_id AND s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
CROSS JOIN (VALUES
    ('SUBMIT',   'DRAFT',    'PENDING',   'SCHOOL', NULL,                       'mk.thietbi',    TIMESTAMP WITH TIME ZONE '2025-09-16 08:30:00+07'),
    ('APPROVE',  'PENDING',  'APPROVED',  'SCHOOL', 'Đã kiểm nhận đủ hàng.',    'mk.hieutruong', TIMESTAMP WITH TIME ZONE '2025-09-16 14:05:00+07'),
    ('COMPLETE', 'APPROVED', 'COMPLETED', NULL,     'Ghi tăng 17 tài sản.',     'mk.hieutruong', TIMESTAMP WITH TIME ZONE '2025-09-16 14:05:01+07')
) AS e(action, from_status, to_status, step, note, username, at)
JOIN users u ON u.username = e.username
WHERE i.code = 'NK-2025-00001'
  AND NOT EXISTS (SELECT 1 FROM voucher_events x WHERE x.resource = 'equipment_intakes' AND x.voucher_id = i.id);

-- Tài sản sinh ra từ ba dòng trên. Mã TT.TR.MH.LT.ST.NC: 79 = TP.HCM, TR = short_code của trường,
-- MH = hai chữ số của môn (sort_order / 10), LT = TB (vật lý), ST = số thứ tự trong trường, NC = năm.
INSERT INTO equipment (school_id, code, name, sort_order, active, catalog_id, physical_or_digital, asset_category,
                       serial_number, model, manufacturer, unit_id, quantity, origin_source_id, acquisition_method_id,
                       funding_source, usage_start_year, received_date, purchase_date, original_value, remaining_value,
                       warranty_expiry, room_id, condition, status, intake_line_id, created_at, created_by_id)
SELECT i.school_id,
       '79.' || s.short_code || '.' || lpad((sub.sort_order / 10)::text, 2, '0') || '.TB.'
           || lpad((row_number() OVER (ORDER BY l.line_no, g.n))::text, 3, '0') || '.25',
       l.name, NULL, TRUE, l.catalog_id, 'PHYSICAL', l.asset_category,
       upper(left(c.code, 3)) || '25-' || lpad((l.line_no * 100 + g.n)::text, 5, '0'),
       l.model, l.manufacturer, c.unit_id, 1,
       i.origin_source_id, i.acquisition_method_id, i.funding_source, 2025, i.intake_date, i.document_date,
       l.unit_price, l.unit_price, (i.intake_date + INTERVAL '24 months')::date,
       l.room_id, 'TOT', CASE WHEN r.code = 'KHO' THEN 'IN_STOCK' ELSE 'IN_USE' END,
       l.id, i.completed_at, i.completed_by_id
FROM equipment_intakes i
JOIN schools s ON s.id = i.school_id AND s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
JOIN equipment_intake_lines l ON l.intake_id = i.id
JOIN equipment_catalogs c ON c.id = l.catalog_id
LEFT JOIN subjects sub ON sub.id = c.subject_id
LEFT JOIN rooms r ON r.id = l.room_id
CROSS JOIN LATERAL generate_series(1, l.received_quantity) AS g(n)
WHERE i.code = 'NK-2025-00001'
  AND NOT EXISTS (SELECT 1 FROM equipment x WHERE x.intake_line_id = l.id);

INSERT INTO equipment_history (equipment_id, action, voucher_resource, voucher_id, voucher_code, note, actor_id, actor_name, created_at)
SELECT e.id, 'GHI_TANG', 'equipment_intakes', i.id, i.code, 'Ghi tăng theo phiếu nhập ' || i.code, u.id, u.full_name, i.completed_at
FROM equipment e
JOIN equipment_intake_lines l ON l.id = e.intake_line_id
JOIN equipment_intakes i ON i.id = l.intake_id AND i.code = 'NK-2025-00001'
JOIN users u ON u.id = i.completed_by_id
WHERE NOT EXISTS (SELECT 1 FROM equipment_history h WHERE h.equipment_id = e.id AND h.action = 'GHI_TANG');

-- ---------------------------------------------------------------- 7. Thiết bị có sẵn từ trước (nhập tay / khai số dư đầu kỳ)
--
-- ST từ 101 để không trùng dãy của phiếu nhập trên; NC là năm nhận.
INSERT INTO equipment (school_id, code, name, sort_order, active, catalog_id, physical_or_digital, asset_category,
                       serial_number, model, manufacturer, unit_id, quantity, origin_source_id, acquisition_method_id,
                       funding_source, usage_start_year, received_date, original_value, remaining_value, room_id,
                       condition, status, note, created_at)
SELECT s.id,
       '79.' || s.short_code || '.' || lpad((sub.sort_order / 10)::text, 2, '0') || '.TB.' || v.st || '.' || right(v.year::text, 2),
       c.name, NULL, TRUE, c.id, 'PHYSICAL', c.asset_category, v.serial, v.model, v.maker, c.unit_id, v.qty,
       (SELECT id FROM origin_sources WHERE code = v.origin_code),
       (SELECT id FROM acquisition_methods WHERE code = v.acq_code),
       v.funding, v.year, make_date(v.year, 8, 20), v.value, v.remaining,
       (SELECT id FROM rooms r WHERE r.school_id = s.id AND r.code = v.room_code),
       v.cond, v.status, 'Khai số dư đầu kỳ từ sổ cũ.', now()
FROM (VALUES
    -- THPT Nguyễn Thị Minh Khai
    ('THPT_NGUYEN_THI_MINH_KHAI', '101', 'TIVI65',     'TV65-22-0001', 'UA65AU7002', 'Samsung', 1, 2022, 'NSNN',   'MUASAM',  'STATE_BUDGET', 'P101',  15900000, 8000000,  'TOT',  'IN_USE'),
    ('THPT_NGUYEN_THI_MINH_KHAI', '102', 'TIVI65',     'TV65-22-0002', 'UA65AU7002', 'Samsung', 1, 2022, 'NSNN',   'MUASAM',  'STATE_BUDGET', 'P102',  15900000, 8000000,  'KHA',  'IN_USE'),
    ('THPT_NGUYEN_THI_MINH_KHAI', '103', 'LAPTOP',     'LT-23-0001',   'ThinkPad E14', 'Lenovo', 1, 2023, 'NSNN',   'MUASAM',  'STATE_BUDGET', 'KHO',   21000000, 14000000, 'TOT',  'IN_STOCK'),
    ('THPT_NGUYEN_THI_MINH_KHAI', '104', 'MAYIN',      'MI-21-0001',   'LaserJet M404', 'HP',    1, 2021, 'NSNN',   'MUASAM',  'STATE_BUDGET', 'TV',    6500000,  1300000,  'HONG', 'BROKEN'),
    ('THPT_NGUYEN_THI_MINH_KHAI', '105', 'KINHHIENVI', 'KHV-20-0001',  'CX23',        'Olympus', 1, 2020, 'TAITRO', 'TAITRO',  'SPONSORSHIP',  'BM-SH', 9800000,  2000000,  'KHA',  'IN_USE'),
    ('THPT_NGUYEN_THI_MINH_KHAI', '106', 'KINHHIENVI', 'KHV-20-0002',  'CX23',        'Olympus', 1, 2020, 'TAITRO', 'TAITRO',  'SPONSORSHIP',  'BM-SH', 9800000,  2000000,  'TOT',  'IN_USE'),
    ('THPT_NGUYEN_THI_MINH_KHAI', '107', 'CANDIENTU',  'CDT-22-0001',  'PX224',       'Ohaus',   1, 2022, 'NSNN',   'MUASAM',  'STATE_BUDGET', 'BM-HH', 7200000,  3600000,  'TOT',  'IN_USE'),
    ('THPT_NGUYEN_THI_MINH_KHAI', '108', 'QUADIACAU',  NULL,           NULL,          NULL,      1, 2019, 'NSNN',   'DUOCCAP', 'STATE_BUDGET', 'P201',  850000,   0,        'TRUNG_BINH', 'IN_USE'),
    ('THPT_NGUYEN_THI_MINH_KHAI', '109', 'BANDOVN',    NULL,           NULL,          NULL,      6, 2023, 'NSNN',   'DUOCCAP', 'STATE_BUDGET', 'P202',  120000,   60000,    'TOT',  'IN_USE'),
    -- THPT Lê Quý Đôn
    ('THPT_LE_QUY_DON', '101', 'MAYCHIEU',   'MC-23-0001',   'EB-X51',      'Epson',   1, 2023, 'NSNN',   'MUASAM',  'STATE_BUDGET', 'P101',  18500000, 11100000, 'TOT',  'IN_USE'),
    ('THPT_LE_QUY_DON', '102', 'MAYCHIEU',   'MC-23-0002',   'EB-X51',      'Epson',   1, 2023, 'NSNN',   'MUASAM',  'STATE_BUDGET', 'P102',  18500000, 11100000, 'TOT',  'IN_USE'),
    ('THPT_LE_QUY_DON', '103', 'MAYCHIEU',   'MC-23-0003',   'EB-X51',      'Epson',   1, 2023, 'NSNN',   'MUASAM',  'STATE_BUDGET', 'P201',  18500000, 11100000, 'KHA',  'IN_USE'),
    ('THPT_LE_QUY_DON', '104', 'BOTN_COHOC', 'CH-22-0001',   'VL-CH-2022',  'Thiết bị Giáo dục Sài Gòn', 1, 2022, 'NSNN', 'MUASAM', 'STATE_BUDGET', 'BM-VL', 7600000, 3800000, 'TOT', 'IN_USE'),
    ('THPT_LE_QUY_DON', '105', 'BOTN_QUANG', 'QH-22-0001',   'VL-QH-2022',  'Thiết bị Giáo dục Sài Gòn', 1, 2022, 'NSNN', 'MUASAM', 'STATE_BUDGET', 'BM-VL', 8100000, 4050000, 'KEM', 'IN_USE'),
    ('THPT_LE_QUY_DON', '106', 'MOHINHADN',  NULL,           NULL,          NULL,      1, 2021, 'XHH',    'TAITRO',  'SPONSORSHIP',  'BM-SH', 3200000,  640000,   'TOT',  'IN_USE'),
    ('THPT_LE_QUY_DON', '107', 'TUHUTKHI',   'THK-19-0001',  'FH-1200',     'Esco',    1, 2019, 'NSNN',   'MUASAM',  'STATE_BUDGET', 'BM-HH', 42000000, 12600000, 'KEM',  'IN_USE')
) AS v(school_code, st, catalog_code, serial, model, maker, qty, year, origin_code, acq_code, funding, room_code, value, remaining, cond, status)
JOIN schools s ON s.code = v.school_code
JOIN equipment_catalogs c ON c.code = v.catalog_code
LEFT JOIN subjects sub ON sub.id = c.subject_id
WHERE NOT EXISTS (SELECT 1 FROM equipment x WHERE x.school_id = s.id AND x.serial_number = v.serial)
  AND NOT EXISTS (SELECT 1 FROM equipment x WHERE x.school_id = s.id
                  AND x.code = '79.' || s.short_code || '.' || lpad((sub.sort_order / 10)::text, 2, '0') || '.TB.' || v.st || '.' || right(v.year::text, 2));

-- ---------------------------------------------------------------- 8. Đề xuất mua sắm (NC) và kế hoạch của Sở
INSERT INTO document_number_sequences (school_id, prefix, current_number)
SELECT s.id, 'MS-2026', 1 FROM schools s WHERE s.code IN ('THPT_NGUYEN_THI_MINH_KHAI', 'THPT_LE_QUY_DON')
ON CONFLICT (school_id, prefix) DO NOTHING;

-- MK: đã qua lãnh đạo trường, đang chờ Sở duyệt.
INSERT INTO purchase_proposals (school_id, code, status, approval_step, reached_step, submitted_at, submitted_by_id,
                                proposal_date, budget_year, funding_source, reason, created_at, created_by_id)
SELECT s.id, 'MS-2026-00001', 'PENDING', 'MANAGING_BODY', 'MANAGING_BODY',
       TIMESTAMP WITH TIME ZONE '2026-01-20 09:00:00+07', u.id,
       DATE '2026-01-20', 2026, 'STATE_BUDGET',
       'Bổ sung bảng tương tác cho khối 10 theo chương trình GDPT 2018; kính hiển vi phòng Sinh còn thiếu so với định mức.',
       TIMESTAMP WITH TIME ZONE '2026-01-19 15:00:00+07', u.id
FROM schools s JOIN users u ON u.username = 'mk.thietbi'
WHERE s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
  AND NOT EXISTS (SELECT 1 FROM purchase_proposals x WHERE x.school_id = s.id AND x.code = 'MS-2026-00001');

-- MK: nháp, chưa trình, chưa có số.
INSERT INTO purchase_proposals (school_id, code, status, proposal_date, budget_year, funding_source, reason, created_at, created_by_id)
SELECT s.id, NULL, 'DRAFT', DATE '2026-02-10', 2026, 'STATE_BUDGET',
       'Tủ hút khí độc phòng Hoá đã hỏng, không sửa được.', now(), u.id
FROM schools s JOIN users u ON u.username = 'mk.thietbi'
WHERE s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
  AND NOT EXISTS (SELECT 1 FROM purchase_proposals x WHERE x.school_id = s.id AND x.status = 'DRAFT'
                  AND x.reason LIKE 'Tủ hút khí độc%');

-- LQD: Sở đã duyệt, chờ vào kế hoạch.
INSERT INTO purchase_proposals (school_id, code, status, approval_step, reached_step, submitted_at, submitted_by_id,
                                proposal_date, budget_year, funding_source, reason, created_at, created_by_id)
SELECT s.id, 'MS-2026-00001', 'APPROVED', NULL, 'MANAGING_BODY',
       TIMESTAMP WITH TIME ZONE '2026-01-12 10:00:00+07', u.id,
       DATE '2026-01-12', 2026, 'STATE_BUDGET',
       'Trang bị máy tính cho phòng máy 1 (hiện chưa có máy nào).',
       TIMESTAMP WITH TIME ZONE '2026-01-11 14:00:00+07', u.id
FROM schools s JOIN users u ON u.username = 'lqd.thietbi'
WHERE s.code = 'THPT_LE_QUY_DON'
  AND NOT EXISTS (SELECT 1 FROM purchase_proposals x WHERE x.school_id = s.id AND x.code = 'MS-2026-00001');

INSERT INTO purchase_proposal_lines (proposal_id, line_no, kind, catalog_id, name, specification, unit_name, quantity,
                                     unit_price, priority, current_quantity, required_quantity)
SELECT p.id, v.line_no, v.kind, c.id, c.name, v.spec, un.name, v.qty, v.price, v.priority, v.current, v.required
FROM (VALUES
    ('THPT_NGUYEN_THI_MINH_KHAI', 'MS-2026-00001', 1, 'NEW',     'BANGTUONGTAC', 'Bảng 86 inch, cảm ứng 20 điểm, kèm máy tính OPS', 4,  45000000, 1, 0, 4),
    ('THPT_NGUYEN_THI_MINH_KHAI', 'MS-2026-00001', 2, 'NEW',     'KINHHIENVI',   'Kính hiển vi quang học 2 mắt, phóng đại 40x–1000x', 6, 9800000, 2, 2, 8),
    ('THPT_LE_QUY_DON',           'MS-2026-00001', 1, 'NEW',     'MAYTINHBAN',   'Core i5, RAM 16GB, SSD 512GB, màn 24 inch', 40, 12300000, 1, 0, 40),
    ('THPT_LE_QUY_DON',           'MS-2026-00001', 2, 'REPLACE', 'BOTN_QUANG',   'Thay bộ quang học đã kém', 1, 8100000, 3, 1, 6)
) AS v(school_code, proposal_code, line_no, kind, catalog_code, spec, qty, price, priority, current, required)
JOIN schools s ON s.code = v.school_code
JOIN purchase_proposals p ON p.school_id = s.id AND p.code = v.proposal_code
JOIN equipment_catalogs c ON c.code = v.catalog_code
LEFT JOIN units un ON un.id = c.unit_id
WHERE NOT EXISTS (SELECT 1 FROM purchase_proposal_lines x WHERE x.proposal_id = p.id AND x.line_no = v.line_no);

-- Dòng của đề xuất nháp (không có số phiếu).
INSERT INTO purchase_proposal_lines (proposal_id, line_no, kind, catalog_id, name, unit_name, quantity, unit_price, priority, current_quantity, required_quantity)
SELECT p.id, 1, 'REPLACE', c.id, c.name, un.name, 1, 42000000, 1, 0, 1
FROM purchase_proposals p
JOIN schools s ON s.id = p.school_id AND s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
JOIN equipment_catalogs c ON c.code = 'TUHUTKHI'
LEFT JOIN units un ON un.id = c.unit_id
WHERE p.status = 'DRAFT' AND p.reason LIKE 'Tủ hút khí độc%'
  AND NOT EXISTS (SELECT 1 FROM purchase_proposal_lines x WHERE x.proposal_id = p.id);

INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, step, note, actor_id, actor_name, created_at)
SELECT 'purchase_proposals', p.id, e.action, e.from_status, e.to_status, e.step, e.note, u.id, u.full_name, e.at
FROM (VALUES
    ('THPT_NGUYEN_THI_MINH_KHAI', 'SUBMIT',  'DRAFT',   'PENDING', 'SCHOOL',        NULL,                              'mk.thietbi',     TIMESTAMP WITH TIME ZONE '2026-01-20 09:00:00+07'),
    ('THPT_NGUYEN_THI_MINH_KHAI', 'APPROVE', 'PENDING', 'PENDING', 'SCHOOL',        'Đồng ý, trình Sở.',               'mk.hieutruong',  TIMESTAMP WITH TIME ZONE '2026-01-21 08:15:00+07'),
    ('THPT_LE_QUY_DON',           'SUBMIT',  'DRAFT',   'PENDING', 'SCHOOL',        NULL,                              'lqd.thietbi',    TIMESTAMP WITH TIME ZONE '2026-01-12 10:00:00+07'),
    ('THPT_LE_QUY_DON',           'APPROVE', 'PENDING', 'PENDING', 'SCHOOL',        'Đồng ý.',                         'lqd.hieutruong', TIMESTAMP WITH TIME ZONE '2026-01-12 16:40:00+07'),
    ('THPT_LE_QUY_DON',           'APPROVE', 'PENDING', 'APPROVED', 'MANAGING_BODY', 'Đưa vào kế hoạch mua sắm 2026.', 'so.lanhdao',     TIMESTAMP WITH TIME ZONE '2026-01-15 11:20:00+07')
) AS e(school_code, action, from_status, to_status, step, note, username, at)
JOIN schools s ON s.code = e.school_code
JOIN purchase_proposals p ON p.school_id = s.id AND p.code = 'MS-2026-00001'
JOIN users u ON u.username = e.username
WHERE NOT EXISTS (SELECT 1 FROM voucher_events x WHERE x.resource = 'purchase_proposals' AND x.voucher_id = p.id);

INSERT INTO procurement_plans (managing_body_id, code, plan_date, title, budget_year, school_year_id, status, note, created_at, created_by_id)
SELECT d.id, 'KHMS-2026-001', DATE '2026-02-01', 'Kế hoạch mua sắm thiết bị dạy học năm 2026', 2026,
       (SELECT id FROM school_years WHERE code = '2025-2026'), 'DRAFT',
       'Gom đề xuất đã duyệt của các trường THPT; chờ trình lãnh đạo Sở.', now(), u.id
FROM departments_of_education d JOIN users u ON u.username = 'so.chuyenvien'
WHERE d.code = 'SO_GDDT_HCM'
  AND NOT EXISTS (SELECT 1 FROM procurement_plans x WHERE x.code = 'KHMS-2026-001');

UPDATE purchase_proposals p
SET plan_id = (SELECT id FROM procurement_plans WHERE code = 'KHMS-2026-001')
FROM schools s
WHERE s.id = p.school_id AND s.code = 'THPT_LE_QUY_DON' AND p.code = 'MS-2026-00001' AND p.plan_id IS NULL;

UPDATE purchase_proposal_lines l
SET planned_quantity = l.quantity
FROM purchase_proposals p JOIN schools s ON s.id = p.school_id
WHERE l.proposal_id = p.id AND s.code = 'THPT_LE_QUY_DON' AND p.code = 'MS-2026-00001' AND l.planned_quantity IS NULL;

-- ---------------------------------------------------------------- 9. Đợt kiểm kê của Sở và phiếu kiểm kê của trường (KK)
INSERT INTO inventory_campaigns (managing_body_id, title, cutoff_date, deadline, note, closed, created_at, created_by_id)
SELECT d.id, 'Kiểm kê tài sản 0h ngày 01/01/2026', DATE '2025-12-31', DATE '2026-01-31',
       'Các trường THPT lập biên bản kiểm kê và nộp trước hạn.', FALSE, now(), u.id
FROM departments_of_education d JOIN users u ON u.username = 'so.chuyenvien'
WHERE d.code = 'SO_GDDT_HCM'
  AND NOT EXISTS (SELECT 1 FROM inventory_campaigns x WHERE x.managing_body_id = d.id AND x.cutoff_date = DATE '2025-12-31');

-- MK: phiếu nháp vừa lập, các dòng là ảnh chụp sổ, chưa kiểm dòng nào.
INSERT INTO inventory_sessions (school_id, code, status, campaign_id, title, inventory_date, council, created_at, created_by_id)
SELECT s.id, NULL, 'DRAFT', c.id, 'Biên bản kiểm kê tài sản 0h ngày 01/01/2026', DATE '2026-01-08',
       'Lê Thị Hiệu Trưởng (tổ trưởng), Phạm Văn Thiết Bị, Nguyễn Văn Kế Toán', now(), u.id
FROM schools s
JOIN inventory_campaigns c ON c.cutoff_date = DATE '2025-12-31'
JOIN users u ON u.username = 'mk.thietbi'
WHERE s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
  AND NOT EXISTS (SELECT 1 FROM inventory_sessions x WHERE x.school_id = s.id AND x.campaign_id = c.id);

INSERT INTO inventory_lines (session_id, line_no, equipment_id, expected_room_id, expected_condition)
SELECT ses.id, row_number() OVER (ORDER BY e.code), e.id, e.room_id, e.condition
FROM inventory_sessions ses
JOIN schools s ON s.id = ses.school_id AND s.code = 'THPT_NGUYEN_THI_MINH_KHAI'
JOIN equipment e ON e.school_id = s.id AND e.status IN ('IN_STOCK', 'IN_USE', 'BROKEN')
WHERE ses.status = 'DRAFT'
  AND NOT EXISTS (SELECT 1 FROM inventory_lines x WHERE x.session_id = ses.id);

-- LQD: đã kiểm xong, đang chờ lãnh đạo trường duyệt; một bộ quang học không thấy, một máy chiếu sai phòng.
INSERT INTO document_number_sequences (school_id, prefix, current_number)
SELECT s.id, 'KK-2026', 1 FROM schools s WHERE s.code = 'THPT_LE_QUY_DON'
ON CONFLICT (school_id, prefix) DO NOTHING;

INSERT INTO inventory_sessions (school_id, code, status, approval_step, reached_step, submitted_at, submitted_by_id,
                                campaign_id, title, inventory_date, council, conclusion, created_at, created_by_id)
SELECT s.id, 'KK-2026-00001', 'PENDING', 'SCHOOL', 'SCHOOL',
       TIMESTAMP WITH TIME ZONE '2026-01-16 15:30:00+07', u.id,
       c.id, 'Biên bản kiểm kê tài sản 0h ngày 01/01/2026', DATE '2026-01-15',
       'Võ Văn Hiệu Trưởng (tổ trưởng), Đặng Thị Thiết Bị, Trần Thị Kế Toán',
       'Thiếu 01 bộ thí nghiệm quang học; 01 máy chiếu đặt sai phòng. Đề nghị ghi giảm và cập nhật vị trí.',
       TIMESTAMP WITH TIME ZONE '2026-01-15 08:00:00+07', u.id
FROM schools s
JOIN inventory_campaigns c ON c.cutoff_date = DATE '2025-12-31'
JOIN users u ON u.username = 'lqd.thietbi'
WHERE s.code = 'THPT_LE_QUY_DON'
  AND NOT EXISTS (SELECT 1 FROM inventory_sessions x WHERE x.school_id = s.id AND x.code = 'KK-2026-00001');

INSERT INTO inventory_lines (session_id, line_no, equipment_id, expected_room_id, expected_condition, found, found_room_id, found_condition, note)
SELECT ses.id, row_number() OVER (ORDER BY e.code), e.id, e.room_id, e.condition,
       CASE WHEN e.serial_number = 'QH-22-0001' THEN FALSE ELSE TRUE END,
       CASE WHEN e.serial_number = 'QH-22-0001' THEN NULL
            WHEN e.serial_number = 'MC-23-0003' THEN (SELECT id FROM rooms r WHERE r.school_id = s.id AND r.code = 'P202')
            ELSE e.room_id END,
       CASE WHEN e.serial_number = 'QH-22-0001' THEN NULL ELSE e.condition END,
       CASE WHEN e.serial_number = 'QH-22-0001' THEN 'Không tìm thấy trong phòng bộ môn và kho.'
            WHEN e.serial_number = 'MC-23-0003' THEN 'Đã chuyển sang P202 từ học kỳ 1, chưa làm thủ tục.' END
FROM inventory_sessions ses
JOIN schools s ON s.id = ses.school_id AND s.code = 'THPT_LE_QUY_DON'
JOIN equipment e ON e.school_id = s.id AND e.status IN ('IN_STOCK', 'IN_USE', 'BROKEN')
WHERE ses.code = 'KK-2026-00001'
  AND NOT EXISTS (SELECT 1 FROM inventory_lines x WHERE x.session_id = ses.id);

INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, step, note, actor_id, actor_name, created_at)
SELECT 'inventory_sessions', ses.id, 'SUBMIT', 'DRAFT', 'PENDING', 'SCHOOL', NULL, u.id, u.full_name,
       TIMESTAMP WITH TIME ZONE '2026-01-16 15:30:00+07'
FROM inventory_sessions ses
JOIN schools s ON s.id = ses.school_id AND s.code = 'THPT_LE_QUY_DON'
JOIN users u ON u.username = 'lqd.thietbi'
WHERE ses.code = 'KK-2026-00001'
  AND NOT EXISTS (SELECT 1 FROM voucher_events x WHERE x.resource = 'inventory_sessions' AND x.voucher_id = ses.id);

-- ---------------------------------------------------------------- 10. Thông báo (HT-06)
INSERT INTO notifications (recipient_id, level, title, body, link, created_at)
SELECT u.id, n.level, n.title, n.body, n.link, n.at
FROM (VALUES
    ('mk.thietbi',     'INFO',    'Sở phát động đợt kiểm kê 0h ngày 01/01/2026',
     'Hạn nộp biên bản: 31/01/2026. Lập phiếu kiểm kê trong mục Kiểm kê.', '/inventory-sessions',
     TIMESTAMP WITH TIME ZONE '2025-12-20 09:00:00+07'),
    ('lqd.thietbi',    'INFO',    'Sở phát động đợt kiểm kê 0h ngày 01/01/2026',
     'Hạn nộp biên bản: 31/01/2026. Lập phiếu kiểm kê trong mục Kiểm kê.', '/inventory-sessions',
     TIMESTAMP WITH TIME ZONE '2025-12-20 09:00:00+07'),
    ('lqd.hieutruong', 'WARNING', 'Biên bản kiểm kê KK-2026-00001 chờ duyệt',
     'Cán bộ thiết bị đã trình biên bản kiểm kê; có 1 tài sản thiếu, 1 sai vị trí.', '/inventory-sessions',
     TIMESTAMP WITH TIME ZONE '2026-01-16 15:30:00+07'),
    ('so.lanhdao',     'WARNING', 'Đề xuất mua sắm MS-2026-00001 của THPT Nguyễn Thị Minh Khai chờ Sở duyệt',
     'Lãnh đạo trường đã duyệt ngày 21/01/2026. Tổng tiền đề xuất 238.800.000 đ.', '/purchase-proposals',
     TIMESTAMP WITH TIME ZONE '2026-01-21 08:15:00+07'),
    ('lqd.thietbi',    'SUCCESS', 'Đề xuất MS-2026-00001 đã được Sở duyệt',
     'Đề xuất được đưa vào kế hoạch mua sắm 2026 (KHMS-2026-001).', '/purchase-proposals',
     TIMESTAMP WITH TIME ZONE '2026-01-15 11:20:00+07')
) AS n(username, level, title, body, link, at)
JOIN users u ON u.username = n.username
WHERE NOT EXISTS (SELECT 1 FROM notifications x WHERE x.recipient_id = u.id AND x.title = n.title);

--rollback DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM users WHERE username IN ('so.lanhdao','so.chuyenvien','mk.hieutruong','mk.thietbi','lqd.hieutruong','lqd.thietbi','btx.thietbi')); DELETE FROM voucher_events WHERE resource IN ('inventory_sessions','purchase_proposals','equipment_intakes'); DELETE FROM inventory_lines; DELETE FROM inventory_sessions; DELETE FROM inventory_campaigns; DELETE FROM purchase_proposal_lines; DELETE FROM purchase_proposals; DELETE FROM procurement_plans; DELETE FROM equipment_history; DELETE FROM equipment; DELETE FROM equipment_intake_lines; DELETE FROM equipment_intakes; DELETE FROM document_number_sequences; DELETE FROM school_code_rules; DELETE FROM rooms; DELETE FROM equipment_norms; DELETE FROM equipment_standards; DELETE FROM equipment_catalogs; DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username IN ('so.lanhdao','so.chuyenvien','mk.hieutruong','mk.thietbi','lqd.hieutruong','lqd.thietbi','btx.thietbi')); DELETE FROM users WHERE username IN ('so.lanhdao','so.chuyenvien','mk.hieutruong','mk.thietbi','lqd.hieutruong','lqd.thietbi','btx.thietbi'); DELETE FROM schools WHERE code IN ('THPT_NGUYEN_THI_MINH_KHAI','THPT_LE_QUY_DON','THPT_BUI_THI_XUAN'); DELETE FROM departments_of_education WHERE code = 'SO_GDDT_HCM';
