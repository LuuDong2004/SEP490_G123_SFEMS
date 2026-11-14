--liquibase formatted sql

-- XOÁ HẲN cấp MẦM NON (QLTB-624, theo trưởng nhóm): hệ thống chỉ quản lý Tiểu học, THCS, THPT.
--
-- `188` chỉ TẮT cấp này khi còn chỗ tham chiếu, nên nó vẫn hiện ở các ô chọn cấp học không lọc theo `active`
-- (vd. hộp Thêm môn học). Ở đây gỡ mọi tham chiếu rồi xoá, dò các khoá ngoại qua information_schema để không
-- sót bảng nào thêm về sau:
--   · lớp thuộc khối mầm non: xoá;
--   · trường cấp mầm non: xoá nếu không còn dữ liệu nào khác trỏ vào; còn dữ liệu thì GIỮ trường, bỏ trống cấp học
--     — không xoá dữ liệu người dùng đã nhập;
--   · cột khác trỏ tới cấp / khối mầm non: cho phép rỗng thì đặt NULL, bắt buộc thì xoá dòng (bảng nối môn ↔ cấp,
--     danh mục ↔ cấp…); dòng nào xoá không được vì còn bị trỏ tới thì giữ và báo trong log.
-- Còn sót tham chiếu thì cấp và khối giữ trạng thái tắt như `188`, không làm hỏng lần khởi động.

--changeset qltb:190-delete-mam-non splitStatements:false
DO $$
DECLARE
    level_id BIGINT;
    grade_ids BIGINT[];
    s RECORD;
    r RECORD;
    nullable BOOLEAN;
BEGIN
    SELECT id INTO level_id FROM education_levels WHERE code = 'MN';
    IF level_id IS NULL THEN
        RETURN;
    END IF;
    SELECT coalesce(array_agg(id), '{}') INTO grade_ids FROM grades WHERE education_level_id = level_id;

    DELETE FROM school_classes WHERE grade_id = ANY (grade_ids);

    FOR s IN SELECT id, code FROM schools WHERE education_level_id = level_id LOOP
        BEGIN
            DELETE FROM schools WHERE id = s.id;
        EXCEPTION WHEN foreign_key_violation THEN
            UPDATE schools SET education_level_id = NULL, updated_at = now() WHERE id = s.id;
            RAISE NOTICE '190: trường % còn dữ liệu, giữ lại và bỏ trống cấp học', s.code;
        END;
    END LOOP;

    FOR r IN
        SELECT kcu.table_name AS t, kcu.column_name AS c, ccu.table_name AS target
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = current_schema()
          AND ccu.table_name IN ('education_levels', 'grades')
          AND NOT (kcu.table_name = 'grades' AND kcu.column_name = 'education_level_id')
    LOOP
        SELECT is_nullable = 'YES' INTO nullable FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = r.t AND column_name = r.c;
        BEGIN
            IF nullable THEN
                EXECUTE format('UPDATE %I SET %I = NULL WHERE %I = ANY ($1)', r.t, r.c, r.c)
                    USING CASE WHEN r.target = 'grades' THEN grade_ids ELSE ARRAY[level_id] END;
            ELSE
                EXECUTE format('DELETE FROM %I WHERE %I = ANY ($1)', r.t, r.c)
                    USING CASE WHEN r.target = 'grades' THEN grade_ids ELSE ARRAY[level_id] END;
            END IF;
        EXCEPTION WHEN foreign_key_violation THEN
            RAISE NOTICE '190: %.% còn bị trỏ tới, giữ lại', r.t, r.c;
        END;
    END LOOP;

    BEGIN
        DELETE FROM grades WHERE id = ANY (grade_ids);
        DELETE FROM education_levels WHERE id = level_id;
    EXCEPTION WHEN foreign_key_violation THEN
        UPDATE grades SET active = FALSE WHERE id = ANY (grade_ids);
        UPDATE education_levels SET active = FALSE WHERE id = level_id;
        RAISE NOTICE '190: cấp mầm non còn tham chiếu, chỉ tắt';
    END;
END
$$;
--rollback SELECT 1;
