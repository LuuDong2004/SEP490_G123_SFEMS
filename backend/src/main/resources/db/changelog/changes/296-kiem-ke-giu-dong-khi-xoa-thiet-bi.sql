--liquibase formatted sql

--changeset luudong:296-kiem-ke-giu-dong-khi-xoa-thiet-bi
--comment Hồ sơ thiết bị đã ghi Mất (do kiểm kê) thì được xoá, nhưng dòng biên bản kiểm kê trỏ tới thiết bị bằng khoá RESTRICT nên lệnh xoá luôn bị chặn. Dòng kiểm kê chụp lại mã và tên thiết bị lúc lập phiếu, khoá ngoại đổi sang SET NULL: xoá hồ sơ thì biên bản vẫn còn đủ dòng, đọc mã và tên từ bản chụp. Dòng cũ lấy mã, tên hiện tại của thiết bị
ALTER TABLE inventory_lines
    ADD COLUMN equipment_code VARCHAR(64),
    ADD COLUMN equipment_name VARCHAR(255);
UPDATE inventory_lines l
SET equipment_code = e.code, equipment_name = e.name
FROM equipment e
WHERE e.id = l.equipment_id;
ALTER TABLE inventory_lines
    DROP CONSTRAINT inventory_lines_equipment_id_fkey,
    ALTER COLUMN equipment_id DROP NOT NULL,
    ADD CONSTRAINT inventory_lines_equipment_id_fkey
        FOREIGN KEY (equipment_id) REFERENCES equipment (id) ON DELETE SET NULL;
--rollback DELETE FROM inventory_lines WHERE equipment_id IS NULL;
--rollback ALTER TABLE inventory_lines DROP CONSTRAINT inventory_lines_equipment_id_fkey, ALTER COLUMN equipment_id SET NOT NULL, ADD CONSTRAINT inventory_lines_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES equipment (id) ON DELETE RESTRICT, DROP COLUMN equipment_name, DROP COLUMN equipment_code;
