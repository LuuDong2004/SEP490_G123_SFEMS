--liquibase formatted sql

--changeset qltb:073-equipment-standards-circulars
--comment Bộ tiêu chuẩn theo cấp học với căn cứ pháp lý thật: TT 37, 38, 39/2021/TT-BGDĐT, sửa đổi bởi TT 26/2023/TT-BGDĐT.
-- Hai bộ DEMO của 061 được đổi thành bộ thật (giữ nguyên id nên không đứt liên kết nào),
-- thêm bộ Tiểu học. Phạm vi là phổ thông công lập (Tiểu học, THCS, THPT), như app Jmix.
UPDATE equipment_standards SET
    code = 'STD-THCS',
    name = 'Danh mục thiết bị dạy học tối thiểu cấp Trung học cơ sở',
    standard_version = '2021, sửa đổi 2023',
    note = 'Căn cứ: Thông tư 38/2021/TT-BGDĐT; sửa đổi, bổ sung bởi Thông tư 26/2023/TT-BGDĐT',
    sort_order = 2,
    updated_at = now()
WHERE code = 'DM-THCS-DEMO';

UPDATE equipment_standards SET
    code = 'STD-THPT',
    name = 'Danh mục thiết bị dạy học tối thiểu cấp Trung học phổ thông',
    standard_version = '2021, sửa đổi 2023',
    note = 'Căn cứ: Thông tư 39/2021/TT-BGDĐT; sửa đổi, bổ sung bởi Thông tư 26/2023/TT-BGDĐT',
    sort_order = 3,
    updated_at = now()
WHERE code = 'DM-THPT-DEMO';

INSERT INTO equipment_standards (code, name, sort_order, active, note, education_level_id, standard_version, created_at)
SELECT 'STD-TH', 'Danh mục thiết bị dạy học tối thiểu cấp Tiểu học', 1, TRUE,
       'Căn cứ: Thông tư 37/2021/TT-BGDĐT; sửa đổi, bổ sung bởi Thông tư 26/2023/TT-BGDĐT',
       l.id, '2021, sửa đổi 2023', now()
FROM education_levels l
WHERE l.code = 'TH'
  AND NOT EXISTS (SELECT 1 FROM equipment_standards s WHERE s.code = 'STD-TH');

-- Văn bản căn cứ của từng bộ: thông tư ban hành (MAIN) và thông tư sửa đổi (AMENDMENT).
INSERT INTO equipment_standard_documents
    (standard_id, document_role, document_no, document_name, issuing_authority, issue_date, effective_date, sort_order, created_at)
SELECT s.id, v.role, v.no, v.name, 'Bộ Giáo dục và Đào tạo', v.issued::date, v.effective::date, v.ord, now()
FROM (VALUES
    ('STD-TH',   'MAIN',      '37/2021/TT-BGDĐT', 'Ban hành Danh mục thiết bị dạy học tối thiểu cấp Tiểu học', '2021-12-30', '2022-02-14', 1),
    ('STD-THCS', 'MAIN',      '38/2021/TT-BGDĐT', 'Ban hành Danh mục thiết bị dạy học tối thiểu cấp Trung học cơ sở', '2021-12-30', '2022-02-14', 1),
    ('STD-THPT', 'MAIN',      '39/2021/TT-BGDĐT', 'Ban hành Danh mục thiết bị dạy học tối thiểu cấp Trung học phổ thông', '2021-12-30', '2022-02-14', 1),
    ('STD-TH',   'AMENDMENT', '26/2023/TT-BGDĐT', 'Sửa đổi, bổ sung Danh mục thiết bị dạy học tối thiểu cấp Tiểu học, THCS, THPT', '2023-12-28', '2024-02-12', 2),
    ('STD-THCS', 'AMENDMENT', '26/2023/TT-BGDĐT', 'Sửa đổi, bổ sung Danh mục thiết bị dạy học tối thiểu cấp Tiểu học, THCS, THPT', '2023-12-28', '2024-02-12', 2),
    ('STD-THPT', 'AMENDMENT', '26/2023/TT-BGDĐT', 'Sửa đổi, bổ sung Danh mục thiết bị dạy học tối thiểu cấp Tiểu học, THCS, THPT', '2023-12-28', '2024-02-12', 2)
) AS v(std, role, no, name, issued, effective, ord)
JOIN equipment_standards s ON s.code = v.std
WHERE NOT EXISTS (
    SELECT 1 FROM equipment_standard_documents d WHERE d.standard_id = s.id AND d.document_no = v.no
);

-- Định mức: thay các dòng DEMO chung chung của 061 bằng các dòng thiết bị cụ thể lấy từ app
-- Jmix. Đây vẫn chỉ là KHUNG — danh mục chi tiết từng môn, từng khối phải nạp từ phụ lục của
-- thông tư (Nhập / xuất dữ liệu), hệ thống không tự bịa số liệu pháp quy.
DELETE FROM equipment_norms WHERE code LIKE 'DM-THCS-DEMO-%' OR code LIKE 'DM-THPT-DEMO-%';

INSERT INTO equipment_norms
    (code, name, sort_order, active, standard_id, equipment_type_id, subject_id, grade_id,
     min_quantity, unit_id, norm_basis, source_document_id, created_at)
SELECT v.code, v.name, v.ord, TRUE, s.id, t.id, sj.id, g.id, v.qty, u.id, v.basis,
       (SELECT d.id FROM equipment_standard_documents d
         WHERE d.standard_id = s.id AND d.document_role = 'MAIN' LIMIT 1),
       now()
FROM (VALUES
    ('NORM-TH-001',   'Bộ đồ dùng dạy học lớp 1',                'STD-TH',   'DO_DUNG_DAY_HOC',     NULL,       'LOP_1', 1,  'BO',  'PER_CLASS',  10),
    ('NORM-TH-002',   'Tivi/màn hình trình chiếu phòng học',     'STD-TH',   'MAY_MOC_THIET_BI',    NULL,       NULL,    1,  'CAI', 'PER_CLASS',  20),
    ('NORM-THCS-001', 'Máy chiếu (projector) trong phòng học',   'STD-THCS', 'MAY_MOC_THIET_BI',    NULL,       NULL,    1,  'CAI', 'PER_CLASS',  10),
    ('NORM-THCS-002', 'Máy tính phục vụ dạy học (phòng máy)',    'STD-THCS', 'THIET_BI_CNTT',       'TIN_HOC',  NULL,    25, 'BO',  'PER_SCHOOL', 20),
    ('NORM-THCS-003', 'Bộ thí nghiệm Vật lý THCS',               'STD-THCS', 'THIET_BI_THI_NGHIEM', 'VAT_LY',   NULL,    1,  'BO',  'PER_SCHOOL', 30),
    ('NORM-THCS-004', 'Bộ thí nghiệm Hóa học THCS',              'STD-THCS', 'THIET_BI_THI_NGHIEM', 'HOA_HOC',  NULL,    1,  'BO',  'PER_SCHOOL', 40),
    ('NORM-THCS-005', 'Bộ mẫu vật, mô hình Sinh học THCS',       'STD-THCS', 'MO_HINH_MAU_VAT',     'SINH_HOC', NULL,    1,  'BO',  'PER_SCHOOL', 50),
    ('NORM-THCS-006', 'Bộ tranh ảnh, bản đồ Lịch sử - Địa lý',   'STD-THCS', 'TRANH_ANH_BAN_DO',    'DIA_LY',   NULL,    1,  'BO',  'PER_CLASS',  60),
    ('NORM-THPT-001', 'Máy chiếu (projector) trong phòng học',   'STD-THPT', 'MAY_MOC_THIET_BI',    NULL,       NULL,    1,  'CAI', 'PER_CLASS',  10),
    ('NORM-THPT-002', 'Bộ thí nghiệm Vật lý THPT',               'STD-THPT', 'THIET_BI_THI_NGHIEM', 'VAT_LY',   NULL,    2,  'BO',  'PER_SCHOOL', 20),
    ('NORM-THPT-003', 'Bộ thí nghiệm Hóa học THPT',              'STD-THPT', 'THIET_BI_THI_NGHIEM', 'HOA_HOC',  NULL,    2,  'BO',  'PER_SCHOOL', 30),
    ('NORM-THPT-004', 'Máy tính phục vụ dạy học (phòng máy)',    'STD-THPT', 'THIET_BI_CNTT',       'TIN_HOC',  NULL,    30, 'BO',  'PER_SCHOOL', 40)
) AS v(code, name, std, type_code, subject_code, grade_code, qty, unit_code, basis, ord)
JOIN equipment_standards s ON s.code = v.std
JOIN equipment_types t ON t.code = v.type_code
LEFT JOIN subjects sj ON sj.code = v.subject_code
LEFT JOIN grades g ON g.code = v.grade_code
LEFT JOIN units u ON u.code = v.unit_code
WHERE NOT EXISTS (SELECT 1 FROM equipment_norms n WHERE n.code = v.code);
