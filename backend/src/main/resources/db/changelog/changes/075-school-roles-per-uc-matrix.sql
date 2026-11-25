--liquibase formatted sql

--changeset qltb:075-school-leader-facilities-and-equipment-write
--comment Lãnh đạo trường theo ma trận quyền (docs/phantich/qltb-use-case.xlsx, sheet "Ma tran quyen"): Cơ sở vật chất "Xem, Sửa, Xuất" (kiêm đầu mối khai báo cơ sở - khối nhà - phòng, CS-01..CS-09), Hồ sơ thiết bị "Xem, Sửa". Trước đây lãnh đạo chỉ XOÁ được cơ sở/khối nhà/phòng mà không thêm, sửa được. Phạm vi dòng write "Chỉ trường của mình" của SCHOOL_LEADER cho bốn resource này đã có từ trước, nên chỉ cần cấp mã quyền — không seed chính sách nào.
WITH grant_map(role_code, code) AS (VALUES
    ('SCHOOL_LEADER', 'campuses:write'), ('SCHOOL_LEADER', 'campuses:export'),
    ('SCHOOL_LEADER', 'buildings:write'), ('SCHOOL_LEADER', 'buildings:export'),
    ('SCHOOL_LEADER', 'rooms:write'),
    ('SCHOOL_LEADER', 'equipment:write')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM grant_map g JOIN roles r ON r.code = g.role_code JOIN permissions p ON p.code = g.code
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
--rollback DELETE FROM role_permissions rp USING roles r, permissions p WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = 'SCHOOL_LEADER' AND p.code IN ('campuses:write','campuses:export','buildings:write','buildings:export','rooms:write','equipment:write');

--changeset qltb:075-school-roles-no-bulk-data-transfer
--comment Nhập / xuất dữ liệu hàng loạt không thuộc phía trường theo UC: nhập trường và cán bộ từ tệp (TC-08) là việc của Quản trị viên, xuất toàn bộ dữ liệu (TH-08) cũng vậy, và không UC nào cho cán bộ thiết bị nhập hàng loạt. Hai đích nhập hiện có (thiết bị, cán bộ) vì thế không còn lối vào từ tài khoản trường. Khi xây CS-09 (lãnh đạo trường nhập cơ sở vật chất từ tệp) thì cấp lại data_transfer:read/write cho SCHOOL_LEADER bằng changelog riêng.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.code IN ('SCHOOL_STAFF', 'SCHOOL_LEADER')
  AND p.code IN ('data_transfer:read', 'data_transfer:write', 'data_transfer:export');
--rollback WITH grant_map(role_code, code) AS (VALUES ('SCHOOL_STAFF','data_transfer:read'),('SCHOOL_STAFF','data_transfer:write'),('SCHOOL_LEADER','data_transfer:read'),('SCHOOL_LEADER','data_transfer:export')) INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM grant_map g JOIN roles r ON r.code = g.role_code JOIN permissions p ON p.code = g.code;
