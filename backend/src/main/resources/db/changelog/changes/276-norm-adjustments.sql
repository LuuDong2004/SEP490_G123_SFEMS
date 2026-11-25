--liquibase formatted sql

--changeset luudong:276-norm-adjustments
--comment Điều chỉnh của từng dòng danh mục tối thiểu (Sở khai tay): không được phép / giảm / thay thế / dùng chung / chọn trong nhóm.
-- Thay mô hình "% giảm tối thiểu + thay A→B theo tỉ lệ" của 154 (bảng 154 giữ nguyên, chưa xoá — phía trường làm lại sau).
--  * adjust_kind: NONE (mặc định — mọi dòng hiện có), REDUCE, SUBSTITUTE, SHARED, CHOOSE_IN_GROUP.
--  * REDUCE: adjust_quantity / (adjust_basis_size × adjust_basis) khi adjust_condition — phải ít hơn định mức gốc.
--  * SUBSTITUTE: thiết bị của danh mục (adjust_substitute_catalog_id) HOẶC hình thức khác (adjust_substitute_text);
--    adjust_substitute_required = trường đã có thứ thay thế thì không tính thiết bị này.
--  * SHARED: các thiết bị dùng chung được ở equipment_norm_adjust_shared.
--  * CHOOSE_IN_GROUP: adjust_group (trong cùng bộ + môn), chọn adjust_group_pick thiết bị trong nhóm.
--  * adjust_basis_text: câu căn cứ trong thông tư — bắt buộc với mọi kiểu trừ NONE.
ALTER TABLE equipment_norms
    ADD COLUMN adjust_kind                  VARCHAR(20)  NOT NULL DEFAULT 'NONE',
    ADD COLUMN adjust_quantity              NUMERIC(14, 3),
    ADD COLUMN adjust_basis                 VARCHAR(20),
    ADD COLUMN adjust_basis_size            INTEGER,
    ADD COLUMN adjust_condition             VARCHAR(500),
    ADD COLUMN adjust_substitute_catalog_id BIGINT REFERENCES equipment_catalogs (id) ON DELETE SET NULL,
    ADD COLUMN adjust_substitute_text       VARCHAR(500),
    ADD COLUMN adjust_substitute_required   BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN adjust_group                 VARCHAR(255),
    ADD COLUMN adjust_group_pick            INTEGER,
    ADD COLUMN adjust_basis_text            VARCHAR(1000),
    ADD CONSTRAINT ck_equipment_norms_adjust_kind
        CHECK (adjust_kind IN ('NONE', 'REDUCE', 'SUBSTITUTE', 'SHARED', 'CHOOSE_IN_GROUP')),
    ADD CONSTRAINT ck_equipment_norms_adjust_quantity CHECK (adjust_quantity IS NULL OR adjust_quantity > 0),
    ADD CONSTRAINT ck_equipment_norms_adjust_basis_size CHECK (adjust_basis_size IS NULL OR adjust_basis_size >= 1),
    ADD CONSTRAINT ck_equipment_norms_adjust_group_pick CHECK (adjust_group_pick IS NULL OR adjust_group_pick >= 1);

CREATE INDEX ix_equipment_norms_adjust_group ON equipment_norms (standard_id, subject_id, adjust_group)
    WHERE adjust_group IS NOT NULL;

CREATE TABLE equipment_norm_adjust_shared (
    norm_id    BIGINT NOT NULL REFERENCES equipment_norms (id) ON DELETE CASCADE,
    catalog_id BIGINT NOT NULL REFERENCES equipment_catalogs (id) ON DELETE CASCADE,
    PRIMARY KEY (norm_id, catalog_id)
);
--rollback DROP TABLE equipment_norm_adjust_shared; DROP INDEX ix_equipment_norms_adjust_group; ALTER TABLE equipment_norms DROP CONSTRAINT ck_equipment_norms_adjust_group_pick, DROP CONSTRAINT ck_equipment_norms_adjust_basis_size, DROP CONSTRAINT ck_equipment_norms_adjust_quantity, DROP CONSTRAINT ck_equipment_norms_adjust_kind, DROP COLUMN adjust_basis_text, DROP COLUMN adjust_group_pick, DROP COLUMN adjust_group, DROP COLUMN adjust_substitute_required, DROP COLUMN adjust_substitute_text, DROP COLUMN adjust_substitute_catalog_id, DROP COLUMN adjust_condition, DROP COLUMN adjust_basis_size, DROP COLUMN adjust_basis, DROP COLUMN adjust_quantity, DROP COLUMN adjust_kind;
