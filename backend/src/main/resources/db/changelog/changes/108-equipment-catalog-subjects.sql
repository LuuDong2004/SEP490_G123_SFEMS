--liquibase formatted sql

-- Một thiết bị trong danh mục dùng được cho NHIỀU môn (bộ cân điện tử: Toán, Hoá học).
--
-- `equipment_catalogs.subject_id` vẫn là MÔN CHÍNH và không đổi nghĩa: phần MH của mã tài sản, bộ lọc
-- theo môn ở màn Thiết bị, báo cáo cộng theo môn và định mức theo giáo viên dạy môn đều đọc cột đó —
-- nên mã đã cấp và mọi con số hiện có giữ nguyên. Bảng này chỉ giữ các môn THÊM (ngoài môn chính), để
-- tra cứu và hiển thị. Thiết bị không có môn nào (cột chính trống, bảng này không có dòng) là dùng chung.
--
-- Xoá thiết bị thì gỡ các dòng nối theo; xoá một môn còn được thiết bị nào đó gắn thì bị từ chối, như
-- mọi khoá ngoại tới danh mục khác.

--changeset qltb:108-equipment-catalog-subjects
CREATE TABLE equipment_catalog_subjects (
    catalog_id BIGINT NOT NULL REFERENCES equipment_catalogs (id) ON DELETE CASCADE,
    subject_id BIGINT NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
    PRIMARY KEY (catalog_id, subject_id)
);
CREATE INDEX idx_equipment_catalog_subjects_subject ON equipment_catalog_subjects (subject_id);
