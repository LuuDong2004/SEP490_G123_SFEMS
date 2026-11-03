--liquibase formatted sql

--changeset luudong:013-pham-vi-quan-tri-va-khoa-ngoai-phong
--comment Quản trị viên được phạm vi "mọi trường" trên các bảng thuộc trường (010 quên vai này, mà defaultScope = NONE nên admin không thấy dòng nào); và xoá phòng còn thiết bị phải bị chặn thay vì lặng lẽ gỡ vị trí của thiết bị.

-- ---------------------------------------------------------------- 1. Phạm vi dòng cho ADMIN
--
-- 010 seed phạm vi cho 4 vai trò Sở / trường nhưng không có ADMIN. Mọi lớp Policies chạy NONE, nên
-- admin gọi danh sách phòng, thiết bị, phiếu đều nhận rỗng và các nhánh "admin duyệt mọi cấp" trong
-- VoucherWorkflow không bao giờ tới. Quản trị viên thấy và ghi được mọi trường.
WITH res(resource) AS (VALUES
    ('rooms'), ('equipment'),
    ('purchase_proposals'), ('equipment_intakes'),
    ('inventory_campaigns'), ('inventory_sessions')),
act(action) AS (VALUES ('read'), ('write'), ('delete'))
INSERT INTO row_level_policy (kind, role_id, resource, action, name, description, scope, created_at)
SELECT 'SCOPE', r.id, res.resource, act.action, 'Quản trị viên: mọi trường',
       'Quản trị hệ thống xem và sửa được dữ liệu của mọi trường.', '{"all": []}'::jsonb, now()
FROM roles r
CROSS JOIN res
CROSS JOIN act
WHERE r.code = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM row_level_policy p
      WHERE p.role_id = r.id AND p.resource = res.resource AND p.action = act.action);

-- ---------------------------------------------------------------- 2. Xoá phòng còn thiết bị thì bị chặn
--
-- 011 khai equipment.room_id ON DELETE SET NULL: xoá một phòng là mọi thiết bị trong đó mất vị trí mà
-- không ai được báo. Quyền rooms:delete (006) là "xoá phòng chưa có thiết bị" — database phải giữ luật đó.
ALTER TABLE equipment DROP CONSTRAINT equipment_room_id_fkey;
ALTER TABLE equipment
    ADD CONSTRAINT equipment_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE RESTRICT;

--rollback ALTER TABLE equipment DROP CONSTRAINT equipment_room_id_fkey; ALTER TABLE equipment ADD CONSTRAINT equipment_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE SET NULL; DELETE FROM row_level_policy WHERE name = 'Quản trị viên: mọi trường';
