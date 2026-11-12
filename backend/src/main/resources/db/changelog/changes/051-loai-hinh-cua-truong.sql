--liquibase formatted sql

--changeset hoangpnd:051-loai-hinh-cua-truong
--comment Trường trỏ tới danh mục loại hình trường (school_types), cho phép trống.

ALTER TABLE schools ADD COLUMN school_type_id BIGINT
    CONSTRAINT fk_schools_school_type REFERENCES school_types (id) ON DELETE RESTRICT;
CREATE INDEX idx_schools_school_type ON schools (school_type_id);

--rollback ALTER TABLE schools DROP COLUMN school_type_id;
