--liquibase formatted sql

--changeset qltb:171-fk-indexes
--comment Chỉ mục cho khoá ngoại của bảng dòng phiếu, cho equipment, và cột thời gian của báo cáo theo kỳ.
-- PostgreSQL không tự tạo chỉ mục cho khoá ngoại: nạp dòng của một phiếu (WHERE <phiếu>_id IN …), xoá phiếu
-- (CASCADE sang dòng) và VoucherHolds (tài sản đang bị phiếu nào giữ — lọc theo equipment_id trên tám bảng dòng)
-- đều quét cả bảng dòng nếu thiếu chúng. Không dùng CONCURRENTLY: bảng hôm nay còn nhỏ, và một lần tạo
-- CONCURRENTLY hỏng để lại chỉ mục INVALID mà IF NOT EXISTS sẽ bỏ qua ở lần chạy sau.

-- Dòng phiếu → phiếu cha.
CREATE INDEX IF NOT EXISTS ix_equipment_allocation_lines_allocation ON equipment_allocation_lines (allocation_id);
CREATE INDEX IF NOT EXISTS ix_equipment_transfer_lines_transfer ON equipment_transfer_lines (transfer_id);
CREATE INDEX IF NOT EXISTS ix_equipment_loan_lines_loan ON equipment_loan_lines (loan_id);
CREATE INDEX IF NOT EXISTS ix_damage_report_lines_report ON damage_report_lines (report_id);
CREATE INDEX IF NOT EXISTS ix_disposal_lines_disposal ON disposal_lines (disposal_id);
CREATE INDEX IF NOT EXISTS ix_inventory_surplus_session ON inventory_surplus (session_id);
CREATE INDEX IF NOT EXISTS ix_repair_order_lines_order ON repair_order_lines (order_id);
CREATE INDEX IF NOT EXISTS ix_warranty_claim_lines_claim ON warranty_claim_lines (claim_id);
CREATE INDEX IF NOT EXISTS ix_maintenance_order_lines_order ON maintenance_order_lines (order_id);
CREATE INDEX IF NOT EXISTS ix_stock_issue_lines_issue ON stock_issue_lines (issue_id);
CREATE INDEX IF NOT EXISTS ix_storage_order_lines_order ON storage_order_lines (order_id);
CREATE INDEX IF NOT EXISTS ix_depreciation_order_lines_order ON depreciation_order_lines (order_id);
CREATE INDEX IF NOT EXISTS ix_room_booking_lines_booking ON room_booking_lines (booking_id);

-- Dòng phiếu → tài sản (stock_issue_lines không có equipment_id: xuất kho đi theo thiết bị trong danh mục).
CREATE INDEX IF NOT EXISTS ix_inventory_lines_equipment ON inventory_lines (equipment_id);
CREATE INDEX IF NOT EXISTS ix_repair_order_lines_equipment ON repair_order_lines (equipment_id);
CREATE INDEX IF NOT EXISTS ix_warranty_claim_lines_equipment ON warranty_claim_lines (equipment_id);
CREATE INDEX IF NOT EXISTS ix_maintenance_order_lines_equipment ON maintenance_order_lines (equipment_id);
CREATE INDEX IF NOT EXISTS ix_storage_order_lines_equipment ON storage_order_lines (equipment_id);
CREATE INDEX IF NOT EXISTS ix_depreciation_order_lines_equipment ON depreciation_order_lines (equipment_id);
CREATE INDEX IF NOT EXISTS ix_room_booking_lines_equipment ON room_booking_lines (equipment_id);
CREATE INDEX IF NOT EXISTS ix_equipment_allocation_lines_transferred
    ON equipment_allocation_lines (transferred_equipment_id) WHERE transferred_equipment_id IS NOT NULL;

-- equipment: xoá cán bộ (SET NULL), đơn vị tính / bộ thông số (RESTRICT) không phải quét cả sổ; lọc trạng thái
-- theo trường (hỏng, chờ thanh lý, trong kho…) đi thẳng vào chỉ mục.
CREATE INDEX IF NOT EXISTS ix_equipment_manager ON equipment (manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_equipment_unit ON equipment (unit_id);
CREATE INDEX IF NOT EXISTS ix_equipment_config ON equipment (config_id) WHERE config_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_equipment_school_status ON equipment (school_id, status);

-- Báo cáo theo kỳ: biến động (equipment_history theo created_at), nằm kho kéo dài (lần dùng cuối theo action),
-- và đếm phiếu theo kỳ trên mười sáu bảng phiếu.
CREATE INDEX IF NOT EXISTS ix_equipment_history_created ON equipment_history (created_at);
CREATE INDEX IF NOT EXISTS ix_equipment_history_action ON equipment_history (action, equipment_id, created_at);
CREATE INDEX IF NOT EXISTS ix_equipment_intakes_created ON equipment_intakes (created_at);
CREATE INDEX IF NOT EXISTS ix_equipment_allocations_created ON equipment_allocations (created_at);
CREATE INDEX IF NOT EXISTS ix_equipment_transfers_created ON equipment_transfers (created_at);
CREATE INDEX IF NOT EXISTS ix_equipment_loans_created ON equipment_loans (created_at);
CREATE INDEX IF NOT EXISTS ix_damage_reports_created ON damage_reports (created_at);
CREATE INDEX IF NOT EXISTS ix_inventory_sessions_created ON inventory_sessions (created_at);
CREATE INDEX IF NOT EXISTS ix_disposals_created ON disposals (created_at);
CREATE INDEX IF NOT EXISTS ix_purchase_proposals_created ON purchase_proposals (created_at);
CREATE INDEX IF NOT EXISTS ix_repair_orders_created ON repair_orders (created_at);
CREATE INDEX IF NOT EXISTS ix_warranty_claims_created ON warranty_claims (created_at);
CREATE INDEX IF NOT EXISTS ix_maintenance_orders_created ON maintenance_orders (created_at);
CREATE INDEX IF NOT EXISTS ix_stock_issues_created ON stock_issues (created_at);
CREATE INDEX IF NOT EXISTS ix_storage_orders_created ON storage_orders (created_at);
CREATE INDEX IF NOT EXISTS ix_depreciation_orders_created ON depreciation_orders (created_at);
CREATE INDEX IF NOT EXISTS ix_consumption_records_created ON consumption_records (created_at);
CREATE INDEX IF NOT EXISTS ix_room_bookings_created ON room_bookings (created_at);
