--liquibase formatted sql

--changeset qltb:144-voucher-links
-- Phiếu liên quan (khối "Phiếu liên quan" trên mọi màn chi tiết phiếu, `GET /api/voucher_links`):
--   * phiếu cấp phát / thu hồi nháp sinh từ biên bản kiểm kê (tài sản sai vị trí) nhớ biên bản đó — trước chỉ ghi số
--     biên bản vào ô mục đích, không bấm về được;
--   * chỉ mục (source_resource, source_id) cho mọi bảng có cột nguồn, và plan_id của phiếu sửa chữa / bảo dưỡng —
--     tra "phiếu nào sinh ra từ phiếu này" không quét cả bảng.
ALTER TABLE equipment_allocations ADD COLUMN source_resource VARCHAR(60);
ALTER TABLE equipment_allocations ADD COLUMN source_id BIGINT;
ALTER TABLE equipment_allocations ADD COLUMN source_code VARCHAR(40);
CREATE INDEX ix_equipment_allocations_source ON equipment_allocations (source_resource, source_id);
CREATE INDEX IF NOT EXISTS ix_damage_reports_source ON damage_reports (source_resource, source_id);
CREATE INDEX IF NOT EXISTS ix_disposals_source ON disposals (source_resource, source_id);
CREATE INDEX IF NOT EXISTS ix_equipment_intakes_source ON equipment_intakes (source_resource, source_id);
CREATE INDEX IF NOT EXISTS ix_repair_orders_source ON repair_orders (source_resource, source_id);
CREATE INDEX IF NOT EXISTS ix_warranty_claims_source ON warranty_claims (source_resource, source_id);
CREATE INDEX IF NOT EXISTS ix_maintenance_orders_plan ON maintenance_orders (plan_id);
--rollback DROP INDEX IF EXISTS ix_maintenance_orders_plan; DROP INDEX IF EXISTS ix_warranty_claims_source; DROP INDEX IF EXISTS ix_repair_orders_source; DROP INDEX IF EXISTS ix_equipment_intakes_source; DROP INDEX IF EXISTS ix_disposals_source; DROP INDEX IF EXISTS ix_damage_reports_source; DROP INDEX IF EXISTS ix_equipment_allocations_source; ALTER TABLE equipment_allocations DROP COLUMN source_code; ALTER TABLE equipment_allocations DROP COLUMN source_id; ALTER TABLE equipment_allocations DROP COLUMN source_resource;
