--liquibase formatted sql

-- Danh mục thiết bị dạy học tối thiểu theo phụ lục TT 37, 38, 39/2021 (sửa đổi bởi TT 26/2023).
--
-- Trước đây một dòng định mức chỉ nói "loại thiết bị X, N cái mỗi lớp" — đủ cho khung mẫu của 073
-- nhưng không chứa được một dòng phụ lục thật: phụ lục ghi TỪNG THIẾT BỊ theo môn → chủ đề, kèm mục
-- đích, mô tả kỹ thuật, đối tượng dùng (GV / HS), đơn vị, số lượng ("01/4 đến 6HS", "07" cho một
-- phòng bộ môn…), lớp áp dụng. Và vì định mức gắn với LOẠI, phần đủ / thiếu đang đếm chung mọi thiết
-- bị cùng loại — bộ thí nghiệm Hoá được tính cho định mức Vật lý.
--
-- Từ đây một dòng định mức gắn với MỘT THIẾT BỊ trong Danh mục thiết bị (catalog_id); loại thiết bị
-- chỉ còn là nhãn phân loại, không bắt buộc. Số lượng giữ cả nguyên văn (quantity_text) lẫn phần đã
-- hiểu: min_quantity (có thể lẻ: 0,5 kg), norm_basis và basis_size — "01/6HS" là 1 theo HỌC SINH
-- với basis_size 6; "01 bộ/5 lớp" là 1 theo LỚP với basis_size 5. Hai căn cứ mới: PER_TEACHER
-- (01/GV) và PER_ROOM (tính cho một phòng học bộ môn). min_quantity trống = phụ lục không ghi số
-- (vd. "Bàn để máy tính"), định mức không tính tự động.
--
-- `optional`: dòng của nhóm TỰ CHỌN — phương án thay thế nhau (ngoại ngữ lựa chọn 2, 3; Công nghệ
-- THPT định hướng công nghiệp HOẶC nông nghiệp), dụng cụ môn thể thao tự chọn ("chỉ trang bị dụng cụ
-- tương ứng môn nhà trường chọn"). Vẫn là một dòng của danh mục, nhưng không vào phần đủ / thiếu:
-- tính hết là bắt trường mua đủ mọi phương án.
--
-- Dữ liệu phụ lục nạp ở 096 (sinh bởi backend/tools/tbdh_toi_thieu.py).

--changeset qltb:095-tbdh-norm-columns
ALTER TABLE equipment_norms ALTER COLUMN equipment_type_id DROP NOT NULL;
ALTER TABLE equipment_norms ALTER COLUMN min_quantity DROP NOT NULL;
ALTER TABLE equipment_norms ALTER COLUMN min_quantity TYPE NUMERIC(14, 3);
ALTER TABLE equipment_norms DROP CONSTRAINT ck_equipment_norms_min_quantity;
ALTER TABLE equipment_norms ADD CONSTRAINT ck_equipment_norms_min_quantity
    CHECK (min_quantity IS NULL OR min_quantity >= 0);
ALTER TABLE equipment_norms
    ADD COLUMN catalog_id    BIGINT REFERENCES equipment_catalogs (id) ON DELETE RESTRICT,
    ADD COLUMN basis_size    INTEGER,
    ADD COLUMN quantity_text VARCHAR(100),
    ADD COLUMN unit_text     VARCHAR(50),
    ADD COLUMN grade_levels  VARCHAR(40),
    ADD COLUMN item_no       VARCHAR(20),
    ADD COLUMN section_name  VARCHAR(500),
    ADD COLUMN topic         VARCHAR(500),
    ADD COLUMN purpose       TEXT,
    ADD COLUMN description   TEXT,
    ADD COLUMN for_teacher   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN for_student   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN optional      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE equipment_norms ADD CONSTRAINT ck_equipment_norms_basis_size
    CHECK (basis_size IS NULL OR basis_size > 0);
-- "6,7,8" — các lớp áp dụng; trống là mọi lớp của cấp học.
ALTER TABLE equipment_norms ADD CONSTRAINT ck_equipment_norms_grade_levels
    CHECK (grade_levels IS NULL OR grade_levels ~ '^[0-9]{1,2}(,[0-9]{1,2})*$');
ALTER TABLE equipment_norms ADD CONSTRAINT ck_equipment_norms_basis
    CHECK (norm_basis IN ('PER_CLASS', 'PER_SCHOOL', 'PER_STUDENT', 'PER_TEACHER', 'PER_ROOM'));
CREATE INDEX ix_equipment_norms_catalog ON equipment_norms (catalog_id);

-- Mô tả / yêu cầu kỹ thuật của thiết bị — chép từ phụ lục, dùng lại khi mua sắm và ghi tăng.
ALTER TABLE equipment_catalogs ADD COLUMN description TEXT;

-- Khung mẫu của 073 nhường chỗ cho phụ lục thật.
DELETE FROM equipment_norms WHERE code LIKE 'NORM-TH-%' OR code LIKE 'NORM-THCS-%' OR code LIKE 'NORM-THPT-%';

--changeset qltb:095-tbdh-subjects
-- Môn của chương trình 2018 mà danh mục môn còn thiếu. Mã dạy học (MH của mã tài sản) lấy các số
-- còn trống 15–19 — vẫn là mã DEMO như 076, thay bằng bảng mã của Bộ trước khi dùng thật.
INSERT INTO subjects (code, name, sort_order, active, teaching_code, created_at)
SELECT v.code, v.name, v.ord, TRUE, v.tc, now()
FROM (VALUES
    ('TIENG_VIET', 'Tiếng Việt',                         150, '15'),
    ('DAO_DUC',    'Đạo đức',                            160, '16'),
    ('LS_DL',      'Lịch sử và Địa lí',                  170, '17'),
    ('KHTN',       'Khoa học tự nhiên',                  180, '18'),
    ('GDKT_PL',    'Giáo dục kinh tế và pháp luật',      190, '19')
) AS v(code, name, ord, tc)
WHERE NOT EXISTS (SELECT 1 FROM subjects s WHERE s.code = v.code);
-- Chương trình 2018 gọi là Giáo dục thể chất; mã giữ nguyên nên mọi liên kết còn nguyên.
UPDATE subjects SET name = 'Giáo dục thể chất', updated_at = now() WHERE code = 'THE_DUC';

--changeset qltb:095-tbdh-units
-- Đơn vị tính phụ lục dùng mà danh mục chưa có.
INSERT INTO units (code, name, sort_order, active, allows_fraction, created_at)
SELECT v.code, v.name, v.ord, TRUE, FALSE, now()
FROM (VALUES
    ('QUA', 'Quả', 150), ('TEP', 'Tệp', 160), ('CAY', 'Cây', 170), ('TAM', 'Tấm', 180),
    ('CAP', 'Cặp', 190), ('HE_THONG', 'Hệ thống', 200), ('BANG', 'Bảng', 210), ('DAY', 'Dây', 220),
    ('DOI', 'Đôi', 230), ('ONG', 'Ống', 240)
) AS v(code, name, ord)
WHERE NOT EXISTS (SELECT 1 FROM units u WHERE u.code = v.code);

--changeset qltb:095-tbdh-consolidated-documents
-- Văn bản hợp nhất là nguồn dữ liệu phụ lục (đã gộp sửa đổi của TT 26/2023) — ghi làm văn bản tham
-- chiếu của từng bộ, và các dòng định mức trỏ về nó.
INSERT INTO equipment_standard_documents
    (standard_id, document_role, document_no, document_name, issuing_authority, issue_date, effective_date, sort_order, created_at)
SELECT s.id, 'REFERENCE', v.no, v.name, 'Bộ Giáo dục và Đào tạo', v.issued::date, NULL, 3, now()
FROM (VALUES
    ('STD-TH',   '02/VBHN-BGDĐT', 'Văn bản hợp nhất Thông tư ban hành Danh mục thiết bị dạy học tối thiểu cấp Tiểu học', '2024-04-26'),
    ('STD-THCS', '03/VBHN-BGDĐT', 'Văn bản hợp nhất Thông tư ban hành Danh mục thiết bị dạy học tối thiểu cấp Trung học cơ sở', '2024-04-26'),
    ('STD-THPT', '06/VBHN-BGDĐT', 'Văn bản hợp nhất Thông tư ban hành Danh mục thiết bị dạy học tối thiểu cấp Trung học phổ thông', '2024-06-10')
) AS v(std, no, name, issued)
JOIN equipment_standards s ON s.code = v.std
WHERE NOT EXISTS (
    SELECT 1 FROM equipment_standard_documents d WHERE d.standard_id = s.id AND d.document_no = v.no
);
