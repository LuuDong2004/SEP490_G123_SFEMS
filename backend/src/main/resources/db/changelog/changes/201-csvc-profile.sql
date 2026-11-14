--liquibase formatted sql

--changeset qltb:201-csvc-profile
-- Hồ sơ hạng mục CSVC (QLTB-631..635) — đủ ô cho biểu số liệu CSVC của Sở (FileMau_BaoCaoSoLieu.xlsx).
--
--   rooms.structure / buildings.structure  kết cấu theo mẫu CSDL HCM: Kiên cố, Bán kiên cố, Tạm, Nhờ, mượn, thuê. KHÁC
--                                          hiện trạng (condition: tốt / xuống cấp…) — một phòng kiên cố vẫn có thể xuống cấp.
--   rooms.combined_type_id                 phòng kết hợp: loại CSVC thứ hai mà phòng dùng chung (phòng học kết hợp nghỉ
--                                          trưa, phòng Đoàn Đội kết hợp truyền thống…).
--   rooms.params                           thông số riêng theo loại (kho sách kín / mở, chỗ đọc, m² để xe đạp / xe máy, sàn tập
--                                          dài × rộng, chiều cao thông thủy…) — khoá theo `room_types.params`.
--   room_types.params                      danh sách thông số của loại: [{key, label, unit, type}], type = number | text. Sở
--                                          thêm / bớt trên màn Loại CSVC, không cần sửa code (QLTB-633).
--   campuses.branch                        cơ sở không phải trường chính: phân hiệu (true) hay điểm trường (false).
--   campuses.student_count / class_count   học sinh, lớp tại từng cơ sở (biểu chia trường chính / phân hiệu / điểm trường).
--   schools.land_area / construction_area  diện tích đất, diện tích xây dựng.
ALTER TABLE rooms
    ADD COLUMN structure        VARCHAR(20)
        CONSTRAINT ck_rooms_structure CHECK (structure IN ('KIEN_CO', 'BAN_KIEN_CO', 'TAM', 'NHO_MUON_THUE')),
    ADD COLUMN combined_type_id BIGINT CONSTRAINT fk_rooms_combined_type REFERENCES room_types (id) ON DELETE RESTRICT,
    ADD COLUMN params           JSONB NOT NULL DEFAULT '{}';
CREATE INDEX idx_rooms_combined_type ON rooms (combined_type_id);

ALTER TABLE buildings
    ADD COLUMN structure VARCHAR(20)
        CONSTRAINT ck_buildings_structure CHECK (structure IN ('KIEN_CO', 'BAN_KIEN_CO', 'TAM', 'NHO_MUON_THUE'));

ALTER TABLE room_types ADD COLUMN params JSONB NOT NULL DEFAULT '[]';

ALTER TABLE campuses
    ADD COLUMN branch        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN student_count INTEGER CONSTRAINT ck_campuses_students CHECK (student_count IS NULL OR student_count >= 0),
    ADD COLUMN class_count   INTEGER CONSTRAINT ck_campuses_classes CHECK (class_count IS NULL OR class_count >= 0);

ALTER TABLE schools
    ADD COLUMN land_area         NUMERIC(12, 2) CONSTRAINT ck_schools_land_area CHECK (land_area IS NULL OR land_area >= 0),
    ADD COLUMN construction_area NUMERIC(12, 2)
        CONSTRAINT ck_schools_construction_area CHECK (construction_area IS NULL OR construction_area >= 0);

-- Thông số theo loại, theo các ô của form CSDL HCM.
UPDATE room_types SET params = '[
  {"key": "closedStackArea", "label": "Diện tích kho sách kín", "unit": "m²", "type": "number"},
  {"key": "openStackArea", "label": "Diện tích kho sách mở", "unit": "m²", "type": "number"},
  {"key": "studentReadingArea", "label": "Diện tích phòng đọc học sinh", "unit": "m²", "type": "number"},
  {"key": "teacherReadingArea", "label": "Diện tích phòng đọc giáo viên", "unit": "m²", "type": "number"}
]'::jsonb WHERE code = 'THU_VIEN';
UPDATE room_types SET params = '[
  {"key": "bicycleArea", "label": "Diện tích để xe đạp", "unit": "m²", "type": "number"},
  {"key": "motorbikeArea", "label": "Diện tích để xe máy", "unit": "m²", "type": "number"}
]'::jsonb WHERE code IN ('KHU_DE_XE_HOC_SINH', 'KHU_DE_XE_CUA_GIAO_VIEN_CAN_BO_NHAN_VIEN');
UPDATE room_types SET params = '[
  {"key": "floorLength", "label": "Chiều dài sàn tập", "unit": "m", "type": "number"},
  {"key": "floorWidth", "label": "Chiều rộng sàn tập", "unit": "m", "type": "number"},
  {"key": "clearHeight", "label": "Chiều cao thông thủy", "unit": "m", "type": "number"}
]'::jsonb WHERE code = 'NHA_DA_NANG';
UPDATE room_types SET params = '[
  {"key": "fieldLength", "label": "Chiều dài sân", "unit": "m", "type": "number"},
  {"key": "fieldWidth", "label": "Chiều rộng sân", "unit": "m", "type": "number"}
]'::jsonb WHERE code = 'SAN_THE_DUC_THE_THAO';
UPDATE room_types SET params = '[
  {"key": "forGrades", "label": "Dành cho khối lớp", "unit": "", "type": "text"}
]'::jsonb WHERE code = 'PHONG_HOC';
UPDATE room_types SET params = '[
  {"key": "beds", "label": "Số chỗ ngủ", "unit": "chỗ", "type": "number"}
]'::jsonb WHERE code = 'NHA_O_NOI_TRU';

--rollback ALTER TABLE schools DROP COLUMN land_area, DROP COLUMN construction_area;
--rollback ALTER TABLE campuses DROP COLUMN branch, DROP COLUMN student_count, DROP COLUMN class_count;
--rollback ALTER TABLE room_types DROP COLUMN params;
--rollback ALTER TABLE buildings DROP COLUMN structure;
--rollback ALTER TABLE rooms DROP COLUMN structure, DROP COLUMN combined_type_id, DROP COLUMN params;
