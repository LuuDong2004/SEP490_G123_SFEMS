--liquibase formatted sql

--changeset qltb:241-drop-room-for-grades
-- Bỏ thông số "Dành cho khối lớp" (forGrades) của loại Phòng học do 201 thêm — trưởng nhóm chốt 12/11/2026: ô chữ tự do,
-- không báo cáo nào dùng, và trùng dữ liệu đã có (lớp học gắn phòng, mỗi lớp có khối → phòng dành cho khối nào thì suy
-- ra từ lớp đang học ở phòng, màn xem phòng hiện sẵn). Xoá khỏi danh sách thông số của loại và khỏi các phòng đã khai.
UPDATE room_types
SET params = COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements(params) p WHERE p ->> 'key' <> 'forGrades'),
                      '[]'::jsonb)
WHERE params @> '[{"key": "forGrades"}]';
-- Không dùng toán tử `?` của jsonb: JDBC hiểu nó là tham số.
UPDATE rooms SET params = params - 'forGrades' WHERE params -> 'forGrades' IS NOT NULL;
--rollback UPDATE room_types SET params = params || '[{"key": "forGrades", "label": "Dành cho khối lớp", "unit": "", "type": "text"}]'::jsonb WHERE code = 'PHONG_HOC';
