--liquibase formatted sql

--changeset qltb:143-repair-order-maintenance-kind
-- Gộp phiếu bảo dưỡng vào phiếu sửa chữa (QLTB-506): một phiếu "Sửa chữa, bảo trì", chọn loại công việc.
--   work_kind  REPAIR (sửa chữa — như trước) | MAINTENANCE (bảo trì — luật của phiếu bảo dưỡng cũ: tài sản đang tốt,
--              không qua duyệt, kết quả Đạt / Cần theo dõi / Không đạt, ghi kết quả thì kế hoạch bảo trì dời một chu kỳ)
--   plan_id    kế hoạch bảo trì phiếu làm theo, chỉ với bảo trì
-- Phiếu bảo dưỡng cũ (maintenance_orders) giữ nguyên để tra cứu, không chuyển dữ liệu: phiếu mới lập ở đây.
ALTER TABLE repair_orders ADD COLUMN work_kind VARCHAR(20) NOT NULL DEFAULT 'REPAIR';
ALTER TABLE repair_orders ADD CONSTRAINT ck_repair_orders_work_kind CHECK (work_kind IN ('REPAIR', 'MAINTENANCE'));
ALTER TABLE repair_orders ADD COLUMN plan_id BIGINT REFERENCES maintenance_plans (id) ON DELETE SET NULL;
ALTER TABLE repair_orders ADD CONSTRAINT ck_repair_orders_plan_kind CHECK (plan_id IS NULL OR work_kind = 'MAINTENANCE');
CREATE INDEX ix_repair_orders_plan ON repair_orders (plan_id);
--rollback DROP INDEX IF EXISTS ix_repair_orders_plan; ALTER TABLE repair_orders DROP CONSTRAINT IF EXISTS ck_repair_orders_plan_kind; ALTER TABLE repair_orders DROP COLUMN IF EXISTS plan_id; ALTER TABLE repair_orders DROP CONSTRAINT IF EXISTS ck_repair_orders_work_kind; ALTER TABLE repair_orders DROP COLUMN IF EXISTS work_kind;
