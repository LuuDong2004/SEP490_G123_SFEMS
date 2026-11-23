--liquibase formatted sql

-- Một phiếu nhập có thể gom hàng của NHIỀU nhà cung cấp, nhiều nguồn kinh phí, bảo hành khác
-- nhau. Đầu phiếu vẫn giữ các giá trị ấy làm MẶC ĐỊNH chung; mỗi dòng khai riêng khi khác đi,
-- để trống thì theo đầu phiếu. Tài sản sinh ra mang giá trị hiệu lực của DÒNG nó
-- (EquipmentIntakeLine.effective*), nên mọi phiếu cũ — cột dòng đều NULL — ra đúng như trước.

--changeset qltb:085-intake-line-overrides
ALTER TABLE equipment_intake_lines
    ADD COLUMN supplier              VARCHAR(255),
    ADD COLUMN document_no           VARCHAR(100),
    ADD COLUMN document_date         DATE,
    ADD COLUMN funding_source        VARCHAR(30),
    ADD COLUMN origin_source_id      BIGINT REFERENCES origin_sources (id) ON DELETE RESTRICT,
    ADD COLUMN acquisition_method_id BIGINT REFERENCES acquisition_methods (id) ON DELETE RESTRICT,
    ADD COLUMN warranty_months       INTEGER,
    ADD CONSTRAINT ck_equipment_intake_lines_warranty CHECK (warranty_months IS NULL OR warranty_months >= 0);
--rollback ALTER TABLE equipment_intake_lines DROP COLUMN supplier, DROP COLUMN document_no, DROP COLUMN document_date, DROP COLUMN funding_source, DROP COLUMN origin_source_id, DROP COLUMN acquisition_method_id, DROP COLUMN warranty_months;
