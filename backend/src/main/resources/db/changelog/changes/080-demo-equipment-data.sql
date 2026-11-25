--liquibase formatted sql

-- DỮ LIỆU DEMO cho ba trường thử của 056 (THCS Bình An, THCS Đặng Tấn Tài, THPT An Lạc):
-- thêm mặt hàng, phòng, và năm đợt ghi tăng đã duyệt xong trong 2023–2025, để các màn
-- Tổng hợp / Theo kho-phòng / Lọc nhanh / báo cáo có số liệu trên mọi môi trường, không
-- phụ thuộc ai đã nhập tay gì trên máy mình.
--
-- Dữ liệu đi ĐÚNG đường hệ thống tự đi khi một phiếu nhập được duyệt: số phiếu lấy từ
-- document_number_sequences, mã tài sản từ equipment_code_sequences (INSERT ... ON CONFLICT,
-- y như DocumentNumberService / EquipmentCodeService), dòng thời gian SUBMIT → APPROVE →
-- COMPLETE trong voucher_events, lịch sử GHI_TANG cho từng tài sản, hàng theo lô cộng vào
-- equipment_stock. Nên chạy trên một môi trường đã có số phiếu / mã tài sản cũng không trùng.
-- Mã TR lấy từ schools.short_code của CHÍNH môi trường đó (056 cấp theo thứ tự id, mỗi
-- nơi một khác).

--changeset qltb:080-demo-catalogs
--comment DỮ LIỆU DEMO. Thêm mặt hàng trải đều các loại thiết bị và các môn, để cột Lọc nhanh và màn Tổng hợp có gì để lọc. Mã do ta đặt.
INSERT INTO equipment_catalogs (code, name, sort_order, active, equipment_type_id, subject_id, unit_id, tracking_type,
                                useful_life_years, minimum_required, asset_category, physical_or_digital,
                                used_by_teacher, used_by_student, self_made, created_at)
SELECT v.code, v.name, v.sort_order, TRUE,
       (SELECT id FROM equipment_types WHERE code = v.type_code),
       (SELECT id FROM subjects WHERE code = v.subject_code),
       (SELECT id FROM units WHERE code = v.unit_code),
       v.tracking, v.life, v.minimum, v.category, v.pod, v.teacher, v.student, FALSE, now()
FROM (VALUES
    ('TB-MAYTINHBANG', 'Máy tính bảng học sinh',          20, 'THIET_BI_CNTT',       'TIN_HOC',   'CHIEC', 'SERIAL', 5,  FALSE, 'FIXED_ASSET',  'PHYSICAL', FALSE, TRUE),
    ('TB-WIFI',        'Bộ phát wifi',                    21, 'THIET_BI_CNTT',       'CHUNG',     'CHIEC', 'SERIAL', 5,  FALSE, 'DURABLE_TOOL', 'PHYSICAL', FALSE, FALSE),
    ('TB-MAYANH',      'Máy ảnh kỹ thuật số',             22, 'MAY_MOC_THIET_BI',    'CHUNG',     'CHIEC', 'SERIAL', 5,  FALSE, 'FIXED_ASSET',  'PHYSICAL', TRUE,  FALSE),
    ('TB-MAYCHIEUVAT', 'Máy chiếu vật thể',               23, 'MAY_MOC_THIET_BI',    'CHUNG',     'CHIEC', 'SERIAL', 5,  FALSE, 'FIXED_ASSET',  'PHYSICAL', TRUE,  FALSE),
    ('TB-DANORGAN',    'Đàn organ điện tử',               24, 'THIET_BI_DAY_HOC',    'AM_NHAC',   'CHIEC', 'SERIAL', 8,  TRUE,  'FIXED_ASSET',  'PHYSICAL', TRUE,  TRUE),
    ('TB-ROBOT',       'Bộ lắp ghép robot giáo dục',      25, 'THIET_BI_DAY_HOC',    'CONG_NGHE', 'BO',    'SERIAL', 5,  FALSE, 'DURABLE_TOOL', 'PHYSICAL', FALSE, TRUE),
    ('TB-BOCOHOC',     'Bộ thí nghiệm cơ học',            26, 'THIET_BI_THI_NGHIEM', 'VAT_LY',    'BO',    'SERIAL', 5,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('TB-BOQUANGHOC',  'Bộ thí nghiệm quang học',         27, 'THIET_BI_THI_NGHIEM', 'VAT_LY',    'BO',    'SERIAL', 5,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('TB-CANDIENTU',   'Cân điện tử phòng thí nghiệm',    28, 'THIET_BI_THI_NGHIEM', 'HOA_HOC',   'CHIEC', 'SERIAL', 6,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('TB-TUHOTKHI',    'Tủ hút khí độc',                  29, 'MAY_MOC_THIET_BI',    'HOA_HOC',   'CAI',   'SERIAL', 10, TRUE,  'FIXED_ASSET',  'PHYSICAL', TRUE,  FALSE),
    ('TB-MOHINHADN',   'Mô hình cấu trúc ADN',            30, 'MO_HINH_MAU_VAT',     'SINH_HOC',  'BO',    'SERIAL', 6,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('TB-QUADIACAU',   'Quả địa cầu',                     31, 'MO_HINH_MAU_VAT',     'DIA_LY',    'CAI',   'SERIAL', 6,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('PM-MOPHONGVL',   'Phần mềm mô phỏng thí nghiệm Vật lý', 32, 'THIET_BI_CNTT',   'VAT_LY',    'BO',    'SERIAL', 3,  FALSE, 'FIXED_ASSET',  'DIGITAL',  TRUE,  TRUE),
    ('TB-KINHLUP',     'Kính lúp cầm tay',                33, 'DUNG_CU',             'SINH_HOC',  'CAI',   'BULK',   3,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', FALSE, TRUE),
    ('HC-NAOH',        'Natri hiđroxit (NaOH) rắn',       34, 'HOA_CHAT',            'HOA_HOC',   'KG',    'BULK',   NULL, TRUE, 'CHEMICAL',    'PHYSICAL', TRUE,  FALSE),
    ('HC-HCL',         'Axit clohiđric (HCl) 36%',        35, 'HOA_CHAT',            'HOA_HOC',   'BINH',  'BULK',   NULL, TRUE, 'CHEMICAL',    'PHYSICAL', TRUE,  FALSE),
    ('TB-BANDOTG',     'Bản đồ thế giới',                 36, 'TRANH_ANH_BAN_DO',    'DIA_LY',    'TO',    'BULK',   3,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  FALSE),
    ('TB-TRANHLS',     'Bộ tranh lịch sử Việt Nam',       37, 'TRANH_ANH_BAN_DO',    'LICH_SU',   'BO',    'BULK',   3,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  FALSE),
    ('TB-BOHINHHOC',   'Bộ dụng cụ vẽ hình học',          38, 'DO_DUNG_DAY_HOC',     'TOAN',      'BO',    'BULK',   3,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', TRUE,  TRUE),
    ('TB-TAINGHE',     'Tai nghe phòng học ngoại ngữ',    39, 'THIET_BI_DAY_HOC',    'TIENG_ANH', 'CHIEC', 'BULK',   3,  FALSE, 'DURABLE_TOOL', 'PHYSICAL', FALSE, TRUE),
    ('TB-GIAVE',       'Giá vẽ',                          40, 'DO_DUNG_DAY_HOC',     'MY_THUAT',  'CAI',   'BULK',   5,  TRUE,  'DURABLE_TOOL', 'PHYSICAL', FALSE, TRUE),
    ('TB-BONGDA',      'Bóng đá',                         41, 'DUNG_CU',             'THE_DUC',   'CAI',   'BULK',   1,  TRUE,  'SUPPLY',       'PHYSICAL', FALSE, TRUE),
    ('TB-BANGHS',      'Bộ bàn ghế học sinh 2 chỗ',       42, 'DO_DUNG_DAY_HOC',     'CHUNG',     'BO',    'BULK',   8,  FALSE, 'DURABLE_TOOL', 'PHYSICAL', FALSE, TRUE)
) AS v(code, name, sort_order, type_code, subject_code, unit_code, tracking, life, minimum, category, pod, teacher, student)
WHERE NOT EXISTS (SELECT 1 FROM equipment_catalogs c WHERE c.code = v.code);
--rollback DELETE FROM equipment_catalogs WHERE code IN ('TB-MAYTINHBANG','TB-WIFI','TB-MAYANH','TB-MAYCHIEUVAT','TB-DANORGAN','TB-ROBOT','TB-BOCOHOC','TB-BOQUANGHOC','TB-CANDIENTU','TB-TUHOTKHI','TB-MOHINHADN','TB-QUADIACAU','PM-MOPHONGVL','TB-KINHLUP','HC-NAOH','HC-HCL','TB-BANDOTG','TB-TRANHLS','TB-BOHINHHOC','TB-TAINGHE','TB-GIAVE','TB-BONGDA','TB-BANGHS');

--changeset qltb:080-demo-catalog-defaults
--comment DỮ LIỆU DEMO. Mặt hàng của 056 chưa khai loại tài sản / TB-PM và môn: điền để tài sản sinh ra có hồ sơ đủ. Chỉ điền ô còn trống.
UPDATE equipment_catalogs c SET
    asset_category = COALESCE(c.asset_category, v.category),
    physical_or_digital = COALESCE(c.physical_or_digital, 'PHYSICAL'),
    subject_id = COALESCE(c.subject_id, (SELECT id FROM subjects WHERE code = v.subject_code)),
    updated_at = now()
FROM (VALUES
    ('TB-MAYCHIEU', 'FIXED_ASSET', 'CHUNG'), ('TB-MAYTINH', 'FIXED_ASSET', 'TIN_HOC'), ('TB-LAPTOP', 'FIXED_ASSET', 'TIN_HOC'),
    ('TB-TIVI', 'FIXED_ASSET', 'CHUNG'), ('TB-BANGTT', 'FIXED_ASSET', 'CHUNG'), ('TB-LOA', 'DURABLE_TOOL', 'CHUNG'),
    ('TB-MAYIN', 'FIXED_ASSET', 'CHUNG'), ('TB-KINHHV', 'DURABLE_TOOL', 'SINH_HOC'), ('TB-BODIEN', 'DURABLE_TOOL', 'VAT_LY'),
    ('TB-MOHINHCT', 'DURABLE_TOOL', 'SINH_HOC'), ('TB-BANDOVN', 'DURABLE_TOOL', 'DIA_LY'), ('TB-ONGNGHIEM', 'SUPPLY', 'HOA_HOC')
) AS v(code, category, subject_code)
WHERE c.code = v.code
  AND (c.asset_category IS NULL OR c.physical_or_digital IS NULL OR c.subject_id IS NULL);
--rollback SELECT 1;

--changeset qltb:080-demo-rooms
--comment DỮ LIỆU DEMO. Phòng học và phòng bộ môn thêm cho ba trường thử, để thiết bị rải ra nhiều nơi trên màn Theo kho/phòng.
INSERT INTO buildings (school_id, code, name, sort_order, active, campus_id, floor_count, condition, created_at)
SELECT s.id, 'NHA-B', 'Nhà B (bộ môn)', 2, TRUE, c.id, 2, 'TOT', now()
FROM schools s JOIN campuses c ON c.school_id = s.id AND c.code = 'CS1'
WHERE s.code IN ('THCSBINHANQ2', 'THCSDANGTANTAI', 'THPTANLAC')
  AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.school_id = s.id AND b.code = 'NHA-B');

INSERT INTO rooms (school_id, code, name, sort_order, active, campus_id, building_id, room_type_id, floor,
                   capacity, condition, usage_status, created_at)
SELECT s.id, r.code, r.name, r.sort_order, TRUE, c.id, b.id,
       (SELECT id FROM room_types WHERE code = r.type_code), r.floor, r.capacity, 'TOT', 'DANG_SU_DUNG', now()
FROM schools s
JOIN campuses c ON c.school_id = s.id AND c.code = 'CS1'
CROSS JOIN (VALUES
    ('P103',  'Phòng học 103',       7,  'PHONG_HOC',       'NHA-A', '1', 45),
    ('P201',  'Phòng học 201',       8,  'PHONG_HOC',       'NHA-A', '2', 45),
    ('P202',  'Phòng học 202',       9,  'PHONG_HOC',       'NHA-A', '2', 45),
    ('P-NN',  'Phòng ngoại ngữ',     10, 'PHONG_BO_MON',    'NHA-B', '1', 40),
    ('P-AN',  'Phòng âm nhạc',       11, 'PHONG_BO_MON',    'NHA-B', '1', 40),
    ('P-MT',  'Phòng mỹ thuật',      12, 'PHONG_BO_MON',    'NHA-B', '2', 40),
    ('P-CN',  'Phòng công nghệ',     13, 'PHONG_BO_MON',    'NHA-B', '2', 40),
    ('P-DN',  'Nhà đa năng',         14, 'PHONG_CHUC_NANG', 'NHA-B', '1', 200)
) AS r(code, name, sort_order, type_code, building_code, floor, capacity)
JOIN buildings b ON b.school_id = s.id AND b.code = r.building_code
WHERE s.code IN ('THCSBINHANQ2', 'THCSDANGTANTAI', 'THPTANLAC')
  AND NOT EXISTS (SELECT 1 FROM rooms x WHERE x.school_id = s.id AND x.code = r.code);
--rollback SELECT 1;

--changeset qltb:080-demo-intakes splitStatements:false
--comment DỮ LIỆU DEMO. Năm đợt ghi tăng đã duyệt cho mỗi trường thử; sinh tài sản có mã chuẩn, lịch sử và tồn kho như khi duyệt thật. Trường nhỏ nhận ít hơn theo hệ số.
DO $$
DECLARE
    sc RECORD;
    it RECORD;
    ln RECORD;
    v_intake_id BIGINT;
    v_line_id BIGINT;
    v_eq_id BIGINT;
    v_code TEXT;
    v_series TEXT;
    v_num INT;
    v_qty INT;
    v_room_id BIGINT;
    v_store BOOLEAN;
    v_cat RECORD;
    v_mh TEXT;
    v_lt TEXT;
    v_key TEXT;
    v_date DATE;
    v_at TIMESTAMPTZ;
    v_canbo RECORD;
    v_ht RECORD;
    v_reason_id BIGINT := (SELECT id FROM movement_reasons WHERE code = 'GT01');
    v_gift_id BIGINT := (SELECT id FROM movement_reasons WHERE code = 'GT03');
BEGIN
    FOR sc IN
        SELECT s.id, upper(trim(s.short_code)) AS tr, v.factor, v.canbo, v.ht
        FROM (VALUES ('THCSBINHANQ2', 1.0, 'thcs.canbo', 'thcs.hieutruong'),
                     ('THCSDANGTANTAI', 0.6, 'thcs2.canbo', 'thcs2.hieutruong'),
                     ('THPTANLAC', 0.8, 'thpt.canbo', 'thpt.hieutruong')) AS v(code, factor, canbo, ht)
        JOIN schools s ON s.code = v.code
        WHERE s.short_code ~ '^[A-Za-z0-9]{2}$'
    LOOP
        SELECT id, full_name INTO v_canbo FROM users WHERE username = sc.canbo;
        SELECT id, full_name INTO v_ht FROM users WHERE username = sc.ht;

        FOR it IN
            SELECT * FROM (VALUES
                (1, DATE '2023-08-15', 'HĐ 15/2023/HĐMB', 'Công ty TNHH Thiết bị giáo dục Sao Mai', 'NGAN_SACH', 'DAU_THAU', 24, 'STATE_BUDGET', 'Mua sắm thiết bị đầu năm học 2023-2024', 'Nguyễn Văn Hải'),
                (2, DATE '2024-01-10', 'BB 02/2024/BBTT', 'Ban đại diện cha mẹ học sinh', 'TAI_TRO', 'TANG', NULL, 'SPONSORSHIP', 'Tiếp nhận thiết bị tài trợ', 'Trần Thị Mai'),
                (3, DATE '2024-09-05', 'HĐ 38/2024/HĐMB', 'Công ty CP Thiết bị giáo dục Hồng Đức', 'NGAN_SACH', 'CHI_DINH_THAU', 12, 'STATE_BUDGET', 'Mua sắm thiết bị Khoa học tự nhiên', 'Lê Quang Vinh'),
                (4, DATE '2025-02-20', 'HĐ 07/2025/HĐMB', 'Công ty TNHH Công nghệ Phong Vũ', 'NGAN_SACH', 'DAU_THAU', 36, 'STATE_BUDGET', 'Mua sắm thiết bị Tin học - Ngoại ngữ', 'Phạm Đức Anh'),
                (5, DATE '2025-09-08', 'HĐ 52/2025/HĐMB', 'Công ty TNHH Sách và Thiết bị giáo dục Miền Nam', 'NGAN_SACH', 'MUA_TRUC_TIEP', 12, 'STATE_BUDGET', 'Bổ sung thiết bị năm học 2025-2026', 'Hoàng Minh Tuấn')
            ) AS t(no, intake_date, doc_no, supplier, origin_code, acq_code, warranty, funding, note, delivered_by)
            ORDER BY no
        LOOP
            v_date := it.intake_date;
            v_at := (v_date + TIME '09:30') AT TIME ZONE 'Asia/Ho_Chi_Minh';

            -- Số phiếu: cùng bộ đếm với DocumentNumberService.
            v_series := 'NK-' || extract(YEAR FROM v_date)::int;
            INSERT INTO document_number_sequences (school_id, prefix, current_number) VALUES (sc.id, v_series, 1)
            ON CONFLICT (school_id, prefix) DO UPDATE SET current_number = document_number_sequences.current_number + 1
            RETURNING current_number INTO v_num;

            INSERT INTO equipment_intakes (school_id, code, intake_date, document_no, document_date, supplier, funding_source,
                                           origin_source_id, acquisition_method_id, warranty_months, note, status,
                                           confirmed_at, confirmed_by_id, submitted_at, submitted_by_id, details,
                                           created_at, created_by_id)
            VALUES (sc.id, v_series || '-' || lpad(v_num::text, 5, '0'), v_date, it.doc_no, v_date - 3, it.supplier, it.funding,
                    (SELECT id FROM origin_sources WHERE code = it.origin_code),
                    (SELECT id FROM acquisition_methods WHERE code = it.acq_code),
                    it.warranty, it.note, 'COMPLETED',
                    v_at + INTERVAL '2 hours', v_ht.id, v_at, v_canbo.id,
                    jsonb_build_object('deliveredBy', it.delivered_by),
                    v_at - INTERVAL '1 day', v_canbo.id)
            RETURNING id INTO v_intake_id;

            INSERT INTO voucher_events (resource, voucher_id, action, from_status, to_status, step, actor_id, actor_name, created_at) VALUES
                ('equipment_intakes', v_intake_id, 'SUBMIT', 'DRAFT', 'PENDING', NULL, v_canbo.id, v_canbo.full_name, v_at),
                ('equipment_intakes', v_intake_id, 'APPROVE', 'PENDING', 'APPROVED', 'SCHOOL', v_ht.id, v_ht.full_name, v_at + INTERVAL '2 hours'),
                ('equipment_intakes', v_intake_id, 'COMPLETE', 'APPROVED', 'COMPLETED', NULL, v_ht.id, v_ht.full_name, v_at + INTERVAL '2 hours');

            FOR ln IN
                SELECT * FROM (VALUES
                    (1, 1, 'TB-MAYTINH',     'Máy tính để bàn Dell OptiPlex 3000',   30, 14500000, 'P-TIN'),
                    (1, 2, 'TB-MAYCHIEU',    'Máy chiếu Epson EB-X06',                2, 12800000, 'P101'),
                    (1, 3, 'TB-MAYCHIEU',    'Máy chiếu Epson EB-X06',                2, 12800000, 'P102'),
                    (1, 4, 'TB-MAYCHIEU',    'Máy chiếu Epson EB-X06',                2, 12800000, 'KHO'),
                    (1, 5, 'TB-BODIEN',      'Bộ thí nghiệm điện học lớp 9',          8,  3200000, 'P-TN'),
                    (1, 6, 'TB-KINHHV',      'Kính hiển vi quang học 1000X',         10,  4500000, 'P-TN'),
                    (1, 7, 'TB-BANDOVN',     'Bản đồ hành chính Việt Nam khổ lớn',   15,   250000, 'KHO'),
                    (1, 8, 'TB-ONGNGHIEM',   'Ống nghiệm thuỷ tinh 16x160',          40,   180000, 'P-TN'),
                    (2, 1, 'TB-TIVI',        'Ti vi Samsung 65 inch',                 2, 18900000, 'P101'),
                    (2, 2, 'TB-TIVI',        'Ti vi Samsung 65 inch',                 2, 18900000, 'P102'),
                    (2, 3, 'TB-LOA',         'Bộ loa, âm ly Jarguar',                 3,  6500000, 'P-DN'),
                    (2, 4, 'TB-LOA',         'Bộ loa, âm ly Jarguar',                 3,  6500000, 'KHO'),
                    (2, 5, 'TB-DANORGAN',    'Đàn organ Casio CT-S300',               3,  9800000, 'P-AN'),
                    (2, 6, 'TB-GIAVE',       'Giá vẽ gỗ thông',                      20,   450000, 'P-MT'),
                    (3, 1, 'TB-BOCOHOC',     'Bộ thí nghiệm cơ học lớp 6-9',         10,  2850000, 'P-TN'),
                    (3, 2, 'TB-BOQUANGHOC',  'Bộ thí nghiệm quang học',               8,  3100000, 'P-TN'),
                    (3, 3, 'TB-CANDIENTU',   'Cân điện tử 0,01g',                     4,  5600000, 'P-TN'),
                    (3, 4, 'TB-TUHOTKHI',    'Tủ hút khí độc 1,2m',                   1, 32000000, 'P-TN'),
                    (3, 5, 'TB-MOHINHADN',   'Mô hình cấu trúc ADN',                  6,  1250000, 'P-TN'),
                    (3, 6, 'TB-MOHINHCT',    'Mô hình cơ thể người 85cm',             4,  4800000, 'KHO'),
                    (3, 7, 'TB-KINHLUP',     'Kính lúp cầm tay 10X',                 40,    65000, 'P-TN'),
                    (3, 8, 'HC-NAOH',        'Natri hiđroxit (NaOH) rắn',            10,   120000, 'KHO'),
                    (3, 9, 'HC-HCL',         'Axit clohiđric (HCl) 36% chai 500ml',  12,    95000, 'KHO'),
                    (4, 1, 'TB-LAPTOP',      'Máy tính xách tay Lenovo ThinkPad E14', 12, 16900000, 'KHO'),
                    (4, 2, 'TB-MAYTINHBANG', 'Máy tính bảng Samsung Galaxy Tab A9',  25,  7400000, 'P-TIN'),
                    (4, 3, 'TB-BANGTT',      'Bảng tương tác Hitachi 86 inch',        1, 45000000, 'P201'),
                    (4, 4, 'TB-BANGTT',      'Bảng tương tác Hitachi 86 inch',        1, 45000000, 'P202'),
                    (4, 5, 'TB-BANGTT',      'Bảng tương tác Hitachi 86 inch',        1, 45000000, 'P-NN'),
                    (4, 6, 'TB-WIFI',        'Bộ phát wifi TP-Link EAP225',           4,  2300000, 'KHO'),
                    (4, 7, 'TB-MAYIN',       'Máy in laser Canon LBP2900',            3,  5900000, 'KHO'),
                    (4, 8, 'PM-MOPHONGVL',   'Phần mềm mô phỏng thí nghiệm Vật lý',   1, 18000000, 'P-TIN'),
                    (4, 9, 'TB-TAINGHE',     'Tai nghe có micro Somic',              40,   350000, 'P-NN'),
                    (5, 1, 'TB-MAYANH',      'Máy ảnh Canon EOS M50',                 2, 11500000, 'KHO'),
                    (5, 2, 'TB-MAYCHIEUVAT', 'Máy chiếu vật thể Elmo',                3,  7900000, 'P103'),
                    (5, 3, 'TB-ROBOT',       'Bộ lắp ghép robot giáo dục',           10,  3600000, 'P-CN'),
                    (5, 4, 'TB-QUADIACAU',   'Quả địa cầu 30cm',                      8,   380000, 'KHO'),
                    (5, 5, 'TB-BANDOTG',     'Bản đồ thế giới khổ lớn',              12,   210000, 'KHO'),
                    (5, 6, 'TB-TRANHLS',     'Bộ tranh lịch sử Việt Nam',             6,   850000, 'KHO'),
                    (5, 7, 'TB-BOHINHHOC',   'Bộ dụng cụ vẽ hình học giáo viên',     30,   120000, 'KHO'),
                    (5, 8, 'TB-BONGDA',      'Bóng đá số 5',                         15,   280000, 'P-DN'),
                    (5, 9, 'TB-BANGHS',      'Bộ bàn ghế học sinh 2 chỗ',            40,  1450000, 'P103')
                ) AS l(intake_no, line_no, catalog_code, name, qty, price, room_code)
                WHERE l.intake_no = it.no
                ORDER BY l.line_no
            LOOP
                SELECT c.id, c.tracking_type, c.unit_id, c.physical_or_digital, c.asset_category, s.teaching_code
                INTO v_cat
                FROM equipment_catalogs c LEFT JOIN subjects s ON s.id = c.subject_id
                WHERE c.code = ln.catalog_code;
                CONTINUE WHEN v_cat.id IS NULL;

                v_qty := greatest(1, round(ln.qty * sc.factor)::int);
                SELECT r.id, coalesce(t.code = 'KHO', FALSE) INTO v_room_id, v_store
                FROM rooms r LEFT JOIN room_types t ON t.id = r.room_type_id
                WHERE r.school_id = sc.id AND r.code = ln.room_code;
                IF v_room_id IS NULL THEN
                    v_store := TRUE;
                END IF;

                INSERT INTO equipment_intake_lines (intake_id, line_no, catalog_id, name, physical_or_digital, asset_category,
                                                    document_quantity, received_quantity, unit_price, room_id, generated_count,
                                                    details, created_at, created_by_id)
                VALUES (v_intake_id, ln.line_no, v_cat.id, ln.name, coalesce(v_cat.physical_or_digital, 'PHYSICAL'), v_cat.asset_category,
                        v_qty, v_qty, ln.price, v_room_id, v_qty,
                        jsonb_build_object('movementReason', jsonb_build_object(
                            'id', CASE WHEN it.origin_code = 'TAI_TRO' THEN v_gift_id ELSE v_reason_id END,
                            'name', CASE WHEN it.origin_code = 'TAI_TRO' THEN 'Tài trợ, viện trợ, biếu tặng' ELSE 'Mua sắm mới' END)),
                        v_at - INTERVAL '1 day', v_canbo.id)
                RETURNING id INTO v_line_id;

                IF v_cat.tracking_type = 'SERIAL' THEN
                    -- Mã TT.TR.MH.LT.ST.NC, bộ đếm như EquipmentCodeService; hết 99 số thì bỏ phần dư.
                    v_mh := coalesce(nullif(trim(v_cat.teaching_code), ''), '00');
                    v_lt := CASE WHEN v_cat.physical_or_digital = 'DIGITAL' THEN 'PM' ELSE 'TB' END;
                    v_key := '79.' || sc.tr || '.' || v_mh || '.' || v_lt || '.' || to_char(v_date, 'YY');
                    FOR i IN 1..v_qty LOOP
                        INSERT INTO equipment_code_sequences (school_id, code_prefix, current_number) VALUES (sc.id, v_key, 1)
                        ON CONFLICT (school_id, code_prefix) DO UPDATE SET current_number = equipment_code_sequences.current_number + 1
                        RETURNING current_number INTO v_num;
                        EXIT WHEN v_num > 99;
                        v_code := '79.' || sc.tr || '.' || v_mh || '.' || v_lt || '.' || lpad(v_num::text, 2, '0') || '.' || to_char(v_date, 'YY');

                        INSERT INTO equipment (school_id, code, name, active, catalog_id, physical_or_digital, asset_category, unit_id,
                                               quantity, origin_source_id, acquisition_method_id, funding_source, usage_start_year,
                                               received_date, purchase_date, original_value, remaining_value, warranty_expiry,
                                               room_id, condition, status, specs, intake_line_id, created_at, created_by_id)
                        VALUES (sc.id, v_code, ln.name, TRUE, v_cat.id, coalesce(v_cat.physical_or_digital, 'PHYSICAL'), v_cat.asset_category,
                                v_cat.unit_id, 1,
                                (SELECT id FROM origin_sources WHERE code = it.origin_code),
                                (SELECT id FROM acquisition_methods WHERE code = it.acq_code),
                                it.funding, extract(YEAR FROM v_date)::int, v_date, v_date - 3, ln.price, ln.price,
                                CASE WHEN it.warranty IS NULL THEN NULL ELSE (v_date + make_interval(months => it.warranty))::date END,
                                v_room_id, 'TOT', CASE WHEN v_store THEN 'IN_STOCK' ELSE 'IN_USE' END, '{}'::jsonb, v_line_id,
                                v_at + INTERVAL '2 hours', v_ht.id)
                        RETURNING id INTO v_eq_id;

                        INSERT INTO equipment_history (equipment_id, action, voucher_resource, voucher_id, voucher_code, note,
                                                       actor_id, actor_name, created_at)
                        VALUES (v_eq_id, 'GHI_TANG', 'equipment_intakes', v_intake_id,
                                (SELECT code FROM equipment_intakes WHERE id = v_intake_id),
                                'Ghi tăng theo phiếu nhập, dòng ' || ln.line_no, v_ht.id, v_ht.full_name, v_at + INTERVAL '2 hours');
                    END LOOP;
                ELSE
                    -- Hàng theo lô: cộng tồn tại đúng chỗ, như EquipmentStockService.add.
                    INSERT INTO equipment_stock (school_id, catalog_id, room_id, quantity, created_at, created_by_id)
                    VALUES (sc.id, v_cat.id, v_room_id, v_qty, v_at + INTERVAL '2 hours', v_ht.id)
                    ON CONFLICT (school_id, catalog_id, room_id)
                    DO UPDATE SET quantity = equipment_stock.quantity + EXCLUDED.quantity, updated_at = now();
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
END
$$;
--rollback SELECT 1;
