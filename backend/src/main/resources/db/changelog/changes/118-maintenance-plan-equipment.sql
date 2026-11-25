--liquibase formatted sql

-- Một kế hoạch bảo trì cho NHIỀU tài sản (theo trưởng nhóm): "vệ sinh 30 máy chiếu của trường mỗi quý" là
-- một kế hoạch, không phải ba mươi. Trước đó kế hoạch chỉ gắn một tài sản (`equipment_id`) hoặc một phòng.
--
-- Bảng nối giữ TẤT CẢ tài sản của kế hoạch — kể cả khi chỉ có một. Cột `maintenance_plans.equipment_id`
-- thôi không dùng: giá trị cũ chép sang bảng nối rồi để trống. Phải để trống chứ không giữ làm "tài sản
-- chính": khoá ngoại của nó là ON DELETE CASCADE, nên xoá hồ sơ một tài sản sẽ xoá luôn kế hoạch của ba
-- mươi cái còn lại. Ở bảng nối, xoá hồ sơ một tài sản chỉ gỡ nó khỏi kế hoạch.

--changeset qltb:118-maintenance-plan-equipment
CREATE TABLE maintenance_plan_equipment (
    plan_id      BIGINT NOT NULL REFERENCES maintenance_plans (id) ON DELETE CASCADE,
    equipment_id BIGINT NOT NULL REFERENCES equipment (id) ON DELETE CASCADE,
    PRIMARY KEY (plan_id, equipment_id)
);
CREATE INDEX ix_maintenance_plan_equipment_equipment ON maintenance_plan_equipment (equipment_id);

INSERT INTO maintenance_plan_equipment (plan_id, equipment_id)
SELECT id, equipment_id FROM maintenance_plans WHERE equipment_id IS NOT NULL;

UPDATE maintenance_plans SET equipment_id = NULL WHERE equipment_id IS NOT NULL;
