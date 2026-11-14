--liquibase formatted sql

--changeset qltb:156-school-staff-data-imports
-- Cán bộ thiết bị là người thực tế đổ dữ liệu đầu vào của trường (theo trưởng nhóm): cấp cùng ba quyền
-- `data_imports:*` như lãnh đạo trường (`146`). Phạm vi là trường của chính người gọi (`VisibleSchools`);
-- dữ liệu ghi vẫn đi qua service của từng loại, và cán bộ thiết bị đã có quyền + phạm vi ghi trên cơ sở, khối nhà,
-- phòng, lớp, cán bộ, tổ bộ môn, thiết bị. Chức vụ Hiệu trưởng / Phó hiệu trưởng (`155`) KHÔNG được mở:
-- vùng chờ để trống chức vụ đó kèm lưu ý khi người nhập không có `staff:assign_leadership`.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('data_imports:read', 'data_imports:write', 'data_imports:delete')
WHERE r.code = 'SCHOOL_STAFF'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
--rollback DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = 'SCHOOL_STAFF') AND permission_id IN (SELECT id FROM permissions WHERE code LIKE 'data_imports:%');
