--liquibase formatted sql

--changeset dth:067-voucher-details
--comment Trường chứng từ của phiếu theo app Jmix cũ (số chứng từ, người ký, hội đồng, bồi thường...). Lưu JSON trong cột details của phiếu và của dòng phiếu: đó là thông tin ghi nhận, không trường nào trong đó tham gia nghiệp vụ — trạng thái, tài sản, phòng, ngày chứng từ vẫn là cột thật. Hình dạng hợp lệ do resources/voucher-forms/*.json quyết định, và backend kiểm tra từng khoá.

ALTER TABLE equipment_intakes          ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE equipment_intake_lines     ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE equipment_allocations      ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE equipment_allocation_lines ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE equipment_transfers        ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE equipment_transfer_lines   ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE equipment_loans            ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE equipment_loan_lines       ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE damage_reports             ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE damage_report_lines        ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE inventory_sessions         ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE inventory_lines            ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE disposals                  ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE disposal_lines             ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE purchase_proposals         ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE purchase_proposal_lines    ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE procurement_plans          ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
