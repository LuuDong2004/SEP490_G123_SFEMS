--liquibase formatted sql

-- Một thiết bị trong danh mục dùng được cho NHIỀU cấp học và NHIỀU khối lớp (máy chiếu: mọi cấp; bộ thí
-- nghiệm: lớp 6 và lớp 7) — cùng cách 108 đã làm với môn học.
--
-- `equipment_catalogs.education_level_id` và `grade_id` vẫn là cấp học / khối lớp CHÍNH và không đổi
-- nghĩa: tiền tố mã thiết bị, bộ lọc và mọi báo cáo đang đọc hai cột đó, nên không số liệu nào phải tính
-- lại. Hai bảng này chỉ giữ các cấp học / khối lớp THÊM (ngoài cái chính). Trường chỉ thấy thiết bị đúng
-- cấp học của mình (`EquipmentCatalogService.levelScope`) — từ nay tính cả cấp học thêm.

--changeset qltb:114-equipment-catalog-levels-grades
CREATE TABLE equipment_catalog_levels (
    catalog_id BIGINT NOT NULL REFERENCES equipment_catalogs (id) ON DELETE CASCADE,
    education_level_id BIGINT NOT NULL REFERENCES education_levels (id) ON DELETE RESTRICT,
    PRIMARY KEY (catalog_id, education_level_id)
);
CREATE INDEX idx_equipment_catalog_levels_level ON equipment_catalog_levels (education_level_id);

CREATE TABLE equipment_catalog_grades (
    catalog_id BIGINT NOT NULL REFERENCES equipment_catalogs (id) ON DELETE CASCADE,
    grade_id BIGINT NOT NULL REFERENCES grades (id) ON DELETE RESTRICT,
    PRIMARY KEY (catalog_id, grade_id)
);
CREATE INDEX idx_equipment_catalog_grades_grade ON equipment_catalog_grades (grade_id);
