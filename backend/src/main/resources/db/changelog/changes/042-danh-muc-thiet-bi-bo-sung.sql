--liquibase formatted sql

--changeset tutn:042-danh-muc-thiet-bi-bo-sung
--comment Danh mục thiết bị (DM-02): phương pháp khấu hao, cờ giáo viên tự làm, thiết bị dùng cho nhiều môn và nhiều khối lớp.

ALTER TABLE equipment_catalogs
    ADD COLUMN depreciation_method character varying(30),
    ADD COLUMN self_made boolean DEFAULT false NOT NULL,
    ADD CONSTRAINT ck_equipment_catalogs_depreciation
        CHECK (depreciation_method IS NULL
               OR depreciation_method IN ('STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_OUTPUT'));

-- Thiết bị ngoài danh mục do trường ghi nguồn gốc "tự làm" là đồ tự làm.
UPDATE equipment_catalogs SET self_made = true WHERE origin = 'SELF_MADE';

-- Các môn THÊM ngoài môn chính (subject_id): thiết bị dùng cho nhiều môn. Môn chính vẫn quyết định mã
-- và mọi phép cộng theo môn; bảng này để tra cứu và hiển thị.
CREATE TABLE equipment_catalog_subjects (
    catalog_id bigint NOT NULL REFERENCES equipment_catalogs (id) ON DELETE CASCADE,
    subject_id bigint NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
    CONSTRAINT pk_equipment_catalog_subjects PRIMARY KEY (catalog_id, subject_id)
);

-- Các khối lớp THÊM ngoài khối chính (grade_id): thiết bị dùng cho nhiều khối.
CREATE TABLE equipment_catalog_grades (
    catalog_id bigint NOT NULL REFERENCES equipment_catalogs (id) ON DELETE CASCADE,
    grade_id bigint NOT NULL REFERENCES grades (id) ON DELETE RESTRICT,
    CONSTRAINT pk_equipment_catalog_grades PRIMARY KEY (catalog_id, grade_id)
);

CREATE INDEX ix_equipment_catalog_subjects_subject ON equipment_catalog_subjects (subject_id);
CREATE INDEX ix_equipment_catalog_grades_grade ON equipment_catalog_grades (grade_id);

--rollback DROP TABLE equipment_catalog_grades; DROP TABLE equipment_catalog_subjects; ALTER TABLE equipment_catalogs DROP CONSTRAINT ck_equipment_catalogs_depreciation, DROP COLUMN self_made, DROP COLUMN depreciation_method;
