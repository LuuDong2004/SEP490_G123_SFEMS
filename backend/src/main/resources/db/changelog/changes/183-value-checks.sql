--liquibase formatted sql

-- Kế hoạch validate GĐ 4 (docs/kien-truc/10-ke-hoach-validate.md): ràng buộc miền giá trị ở tầng CSDL cho các cột
-- số người dùng nhập mà chưa có CHECK — tầng dưới giữ sự thật kể cả khi một lối ghi nào đó quên kiểm ở API.
-- NOT VALID: chỉ áp cho dòng ghi MỚI / sửa từ nay, không quét dữ liệu cũ — một dòng cũ lệch chuẩn không được làm
-- hỏng lần triển khai. Khoảng ở đây rộng hơn luật của API (năm từ 1900, không phải 1950) vì nó là lưới cuối.
--changeset qltb:183-value-checks
ALTER TABLE depreciation_order_lines
    ADD CONSTRAINT ck_depreciation_line_values CHECK (
        original_value >= 0 AND depreciation_amount >= 0
        AND accumulated_start >= 0 AND accumulated_depreciation >= 0
        AND depreciation_rate BETWEEN 0 AND 100 AND useful_life_years >= 0) NOT VALID;
ALTER TABLE depreciation_orders
    ADD CONSTRAINT ck_depreciation_period_year CHECK (period_year BETWEEN 1900 AND 2100) NOT VALID;
ALTER TABLE disposal_lines
    ADD CONSTRAINT ck_disposal_line_values CHECK (original_value >= 0 AND remaining_value >= 0) NOT VALID;
ALTER TABLE equipment
    ADD CONSTRAINT ck_equipment_years CHECK (
        production_year BETWEEN 1900 AND 2100 AND usage_start_year BETWEEN 1900 AND 2100) NOT VALID;
ALTER TABLE buildings
    ADD CONSTRAINT ck_buildings_built_year CHECK (built_year BETWEEN 1800 AND 2100) NOT VALID;
ALTER TABLE equipment_allocation_lines
    ADD CONSTRAINT ck_allocation_line_quantity CHECK (quantity > 0 AND stock_before >= 0) NOT VALID;
ALTER TABLE equipment_transfer_lines
    ADD CONSTRAINT ck_transfer_line_quantity CHECK (quantity > 0) NOT VALID;
ALTER TABLE purchase_proposal_lines
    ADD CONSTRAINT ck_proposal_line_required CHECK (required_quantity >= 0) NOT VALID;
ALTER TABLE purchase_proposals
    ADD CONSTRAINT ck_purchase_proposals_budget_year CHECK (budget_year BETWEEN 1900 AND 2100) NOT VALID;
ALTER TABLE procurement_plans
    ADD CONSTRAINT ck_procurement_plans_budget_year CHECK (budget_year BETWEEN 1900 AND 2100) NOT VALID;
ALTER TABLE room_bookings
    ADD CONSTRAINT ck_room_bookings_periods CHECK (
        period_from BETWEEN 1 AND 15 AND period_to BETWEEN 1 AND 15 AND period_from <= period_to) NOT VALID;
ALTER TABLE standard_adjustment_lines
    ADD CONSTRAINT ck_standard_adjustment_base CHECK (base_required >= 0) NOT VALID;
--rollback ALTER TABLE depreciation_order_lines DROP CONSTRAINT ck_depreciation_line_values;
--rollback ALTER TABLE depreciation_orders DROP CONSTRAINT ck_depreciation_period_year;
--rollback ALTER TABLE disposal_lines DROP CONSTRAINT ck_disposal_line_values;
--rollback ALTER TABLE equipment DROP CONSTRAINT ck_equipment_years;
--rollback ALTER TABLE buildings DROP CONSTRAINT ck_buildings_built_year;
--rollback ALTER TABLE equipment_allocation_lines DROP CONSTRAINT ck_allocation_line_quantity;
--rollback ALTER TABLE equipment_transfer_lines DROP CONSTRAINT ck_transfer_line_quantity;
--rollback ALTER TABLE purchase_proposal_lines DROP CONSTRAINT ck_proposal_line_required;
--rollback ALTER TABLE purchase_proposals DROP CONSTRAINT ck_purchase_proposals_budget_year;
--rollback ALTER TABLE procurement_plans DROP CONSTRAINT ck_procurement_plans_budget_year;
--rollback ALTER TABLE room_bookings DROP CONSTRAINT ck_room_bookings_periods;
--rollback ALTER TABLE standard_adjustment_lines DROP CONSTRAINT ck_standard_adjustment_base;
