--liquibase formatted sql

-- Bỏ cấp học MẦM NON (`104`): hệ thống chỉ quản lý Tiểu học, THCS, THPT.
--
-- Không còn gì tham chiếu thì xoá hẳn cấp và bốn khối lớp của nó. Còn tham chiếu (trường, lớp,
-- danh mục đã khai trên môi trường đó) thì chỉ tắt: xoá tiếp sẽ lỗi khoá ngoại làm backend không lên
-- được, hoặc mất dữ liệu người dùng đã nhập. Trường mầm non còn lại phải được xử lý tay.

--changeset qltb:188-remove-mam-non splitStatements:false
DO $$
DECLARE
    level_id education_levels.id%TYPE;
BEGIN
    SELECT id INTO level_id FROM education_levels WHERE code = 'MN';
    IF level_id IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM schools WHERE education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM evidence_criteria WHERE education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM standard_adjustment_rules WHERE education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM equipment_catalog_levels WHERE education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM equipment_catalogs WHERE education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM equipment_standards WHERE education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM room_types WHERE education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM subject_education_levels WHERE education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM subject_groups WHERE education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM grades g JOIN equipment_catalog_grades r ON r.grade_id = g.id WHERE g.education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM grades g JOIN equipment_catalogs r ON r.grade_id = g.id WHERE g.education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM grades g JOIN equipment_norms r ON r.grade_id = g.id WHERE g.education_level_id = level_id)
        OR EXISTS (SELECT 1 FROM grades g JOIN school_classes r ON r.grade_id = g.id WHERE g.education_level_id = level_id)
    THEN
        UPDATE grades SET active = FALSE WHERE education_level_id = level_id;
        UPDATE education_levels SET active = FALSE WHERE id = level_id;
    ELSE
        DELETE FROM grades WHERE education_level_id = level_id;
        DELETE FROM education_levels WHERE id = level_id;
    END IF;
END
$$;
