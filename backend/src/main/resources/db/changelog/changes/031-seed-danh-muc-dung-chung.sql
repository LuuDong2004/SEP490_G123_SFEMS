--liquibase formatted sql

--changeset tutn:031-seed-danh-muc-dung-chung
--comment Dữ liệu mẫu cho danh mục dùng chung phạm vi THPT. Nối theo mã, không ghi cứng id; mã đã có thì bỏ qua (ON CONFLICT DO NOTHING) để chạy được trên máy đã tự nhập vài dòng.

-- Cấp học: phạm vi đồ án chỉ có THPT (Báo cáo 1, LI-06).
INSERT INTO education_levels (code, name, short_name, sort_order, created_at) VALUES
  ('THPT', 'Trung học phổ thông', 'THPT', 10, now())
ON CONFLICT (code) DO NOTHING;

-- Khối lớp của cấp THPT.
INSERT INTO grades (code, name, education_level_id, grade_number, sort_order, created_at)
SELECT g.code, g.name, el.id, g.grade_number, g.sort_order, now()
FROM (VALUES
  ('K10', 'Lớp 10', 10, 10),
  ('K11', 'Lớp 11', 11, 20),
  ('K12', 'Lớp 12', 12, 30)
) AS g(code, name, grade_number, sort_order)
JOIN education_levels el ON el.code = 'THPT'
ON CONFLICT (code) DO NOTHING;

-- Năm học: năm trước, năm nay và năm sau của thời gian làm đồ án.
INSERT INTO school_years (code, name, start_date, end_date, sort_order, created_at) VALUES
  ('2024-2025', 'Năm học 2024-2025', DATE '2024-09-05', DATE '2025-05-31', 10, now()),
  ('2025-2026', 'Năm học 2025-2026', DATE '2025-09-05', DATE '2026-05-31', 20, now()),
  ('2026-2027', 'Năm học 2026-2027', DATE '2026-09-05', DATE '2027-05-31', 30, now())
ON CONFLICT (code) DO NOTHING;

-- Môn học THPT theo Chương trình GDPT 2018. Mã môn ngắn (thành phần MH của mã tài sản) là bản đề
-- xuất, cần thống nhất với người làm sinh mã tài sản (TS-06) trước khi dùng thật.
INSERT INTO subjects (code, name, short_code, sort_order, created_at) VALUES
  ('TOAN',   'Toán',                                   'TO', 10,  now()),
  ('NGUVAN', 'Ngữ văn',                                'NV', 20,  now()),
  ('NGOAINGU', 'Ngoại ngữ',                            'NN', 30,  now()),
  ('VATLI',  'Vật lí',                                 'VL', 40,  now()),
  ('HOAHOC', 'Hoá học',                                'HH', 50,  now()),
  ('SINHHOC','Sinh học',                               'SH', 60,  now()),
  ('LICHSU', 'Lịch sử',                                'LS', 70,  now()),
  ('DIALI',  'Địa lí',                                 'DL', 80,  now()),
  ('GDKTPL', 'Giáo dục kinh tế và pháp luật',          'KP', 90,  now()),
  ('TINHOC', 'Tin học',                                'TH', 100, now()),
  ('CONGNGHE', 'Công nghệ',                            'CN', 110, now()),
  ('AMNHAC', 'Âm nhạc',                                'AN', 120, now()),
  ('MITHUAT','Mĩ thuật',                               'MT', 130, now()),
  ('GDTC',   'Giáo dục thể chất',                      'TC', 140, now()),
  ('GDQPAN', 'Giáo dục quốc phòng và an ninh',         'QP', 150, now()),
  ('HDTN',   'Hoạt động trải nghiệm, hướng nghiệp',    'HN', 160, now()),
  ('DUNGCHUNG', 'Thiết bị dùng chung',                 'DC', 170, now())
ON CONFLICT (code) DO NOTHING;

-- Loại phòng. Chỉ loại "Kho thiết bị" là kho.
INSERT INTO room_types (code, name, warehouse, sort_order, created_at) VALUES
  ('PHONGHOC',   'Phòng học',              false, 10, now()),
  ('BOMON',      'Phòng học bộ môn',       false, 20, now()),
  ('THINGHIEM',  'Phòng thí nghiệm',       false, 30, now()),
  ('MAYTINH',    'Phòng máy tính',         false, 40, now()),
  ('THUVIEN',    'Thư viện',               false, 50, now()),
  ('DANANG',     'Phòng đa năng',          false, 60, now()),
  ('KHO',        'Kho thiết bị',           true,  70, now())
ON CONFLICT (code) DO NOTHING;

-- Loại thiết bị.
INSERT INTO equipment_types (code, name, sort_order, created_at) VALUES
  ('TBDH',     'Thiết bị dạy học',            10, now()),
  ('TBDC',     'Thiết bị dùng chung',         20, now()),
  ('MAYMOC',   'Máy móc, thiết bị văn phòng', 30, now()),
  ('DODUNG',   'Đồ dùng, nội thất',           40, now()),
  ('VATTU',    'Vật tư tiêu hao',             50, now()),
  ('HOACHAT',  'Hoá chất',                    60, now())
ON CONFLICT (code) DO NOTHING;

-- Đơn vị tính.
INSERT INTO units (code, name, sort_order, created_at) VALUES
  ('CAI',   'Cái',   10,  now()),
  ('BO',    'Bộ',    20,  now()),
  ('CHIEC', 'Chiếc', 30,  now()),
  ('HOP',   'Hộp',   40,  now()),
  ('LO',    'Lọ',    50,  now()),
  ('CHAI',  'Chai',  60,  now()),
  ('GOI',   'Gói',   70,  now()),
  ('TO',    'Tờ',    80,  now()),
  ('CUON',  'Cuốn',  90,  now()),
  ('M',     'Mét',   100, now()),
  ('KG',    'Kilôgam', 110, now()),
  ('L',     'Lít',   120, now())
ON CONFLICT (code) DO NOTHING;

-- Nguồn hình thành (nguồn kinh phí).
INSERT INTO origin_sources (code, name, sort_order, created_at) VALUES
  ('NSNN',     'Ngân sách nhà nước',     10, now()),
  ('XHH',      'Xã hội hoá',             20, now()),
  ('TAITRO',   'Tài trợ, viện trợ',      30, now()),
  ('SUNGHIEP', 'Nguồn thu sự nghiệp',    40, now()),
  ('KHAC',     'Nguồn khác',             90, now())
ON CONFLICT (code) DO NOTHING;

-- Phương thức hình thành: tài sản về trường bằng cách nào.
INSERT INTO acquisition_methods (code, name, sort_order, created_at) VALUES
  ('MUASAM',  'Mua sắm',               10, now()),
  ('DUOCCAP', 'Được cấp',              20, now()),
  ('TAITRO',  'Được tặng, tài trợ',    30, now()),
  ('TULAM',   'Tự làm',                40, now()),
  ('KHAC',    'Khác',                  90, now())
ON CONFLICT (code) DO NOTHING;

-- Lý do biến động. Lý do tăng dùng ở dòng phiếu nhập (DR-21); lý do giảm ghi khi kiểm kê phát hiện mất.
INSERT INTO movement_reasons (code, name, direction, sort_order, created_at) VALUES
  ('MUAMOI',   'Mua mới',                          'INCREASE', 10, now()),
  ('CAPPHAT',  'Được cấp phát',                    'INCREASE', 20, now()),
  ('TAITRO',   'Được tặng, tài trợ',               'INCREASE', 30, now()),
  ('THUA_KK',  'Tài sản thừa phát hiện khi kiểm kê', 'INCREASE', 40, now()),
  ('SODUDAUKY','Khai số dư đầu kỳ',                'INCREASE', 50, now()),
  ('MAT_KK',   'Mất, thiếu phát hiện khi kiểm kê', 'DECREASE', 60, now())
ON CONFLICT (code) DO NOTHING;

--rollback DELETE FROM movement_reasons WHERE code IN ('MUAMOI','CAPPHAT','TAITRO','THUA_KK','SODUDAUKY','MAT_KK'); DELETE FROM acquisition_methods WHERE code IN ('MUASAM','DUOCCAP','TAITRO','TULAM','KHAC'); DELETE FROM origin_sources WHERE code IN ('NSNN','XHH','TAITRO','SUNGHIEP','KHAC'); DELETE FROM units WHERE code IN ('CAI','BO','CHIEC','HOP','LO','CHAI','GOI','TO','CUON','M','KG','L'); DELETE FROM equipment_types WHERE code IN ('TBDH','TBDC','MAYMOC','DODUNG','VATTU','HOACHAT'); DELETE FROM room_types WHERE code IN ('PHONGHOC','BOMON','THINGHIEM','MAYTINH','THUVIEN','DANANG','KHO'); DELETE FROM subjects WHERE code IN ('TOAN','NGUVAN','NGOAINGU','VATLI','HOAHOC','SINHHOC','LICHSU','DIALI','GDKTPL','TINHOC','CONGNGHE','AMNHAC','MITHUAT','GDTC','GDQPAN','HDTN','DUNGCHUNG'); DELETE FROM school_years WHERE code IN ('2024-2025','2025-2026','2026-2027'); DELETE FROM grades WHERE code IN ('K10','K11','K12'); DELETE FROM education_levels WHERE code = 'THPT';
