--liquibase formatted sql

-- Quy đổi khi ghi tăng hoá chất, vật tư tiêu hao (QLTB-501). Hoá chất quản lý theo đơn vị ĐO (ml, gam, kg, lít)
-- nhưng mua theo BAO BÌ: 5 lọ, mỗi lọ 100 ml. Dòng phiếu ghi tăng khai quy cách — đơn vị bao bì
-- (`pack_unit_id`, từ danh mục đơn vị tính) và lượng trong một bao bì tính theo đơn vị của thiết bị
-- (`pack_size`). Có quy cách thì số lượng của dòng đếm theo bao bì và đơn giá là giá một bao bì; lúc duyệt,
-- lô vào sổ mang số lượng ĐÃ QUY ĐỔI (5 × 100 = 500 ml) để cấp phát, tiêu hao trừ theo ml thay vì cả lọ.
-- Hai cột đi cùng nhau: cùng trống (không quy đổi) hoặc cùng có.

--changeset qltb:127-intake-line-pack-conversion
ALTER TABLE equipment_intake_lines
    ADD COLUMN pack_unit_id BIGINT REFERENCES units (id),
    ADD COLUMN pack_size NUMERIC(14, 3) CHECK (pack_size IS NULL OR pack_size > 0),
    ADD CONSTRAINT ck_equipment_intake_lines_pack CHECK ((pack_unit_id IS NULL) = (pack_size IS NULL));
