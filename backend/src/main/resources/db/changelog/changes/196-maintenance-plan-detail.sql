--liquibase formatted sql

--changeset qltb:196-maintenance-plan-detail
-- Kế hoạch bảo trì theo mockup (QLTB-505, 584): loại bảo trì, nội dung công việc, chu kỳ "Một lần" / "Hằng
-- tuần" / "Khác" (số ngày giữa hai lần), ngày kết thúc, mốc nhắc riêng của kế hoạch, trạng thái kế hoạch
-- (đang áp dụng / tạm dừng / kết thúc). Kế hoạch cũ: đang áp dụng, nhắc 7 và 1 ngày.
ALTER TABLE maintenance_plans
    ADD COLUMN maintenance_type VARCHAR(30),
    ADD COLUMN work_content     VARCHAR(1000),
    ADD COLUMN interval_days    INTEGER,
    ADD COLUMN end_date         DATE,
    ADD COLUMN remind_days      VARCHAR(20) DEFAULT '7,1',
    ADD COLUMN plan_status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE maintenance_plans ADD CONSTRAINT ck_maintenance_plans_interval
    CHECK (interval_days IS NULL OR interval_days BETWEEN 1 AND 3650);
--rollback ALTER TABLE maintenance_plans DROP CONSTRAINT ck_maintenance_plans_interval, DROP COLUMN plan_status, DROP COLUMN remind_days, DROP COLUMN end_date, DROP COLUMN interval_days, DROP COLUMN work_content, DROP COLUMN maintenance_type;
