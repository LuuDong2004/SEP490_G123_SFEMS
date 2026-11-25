--liquibase formatted sql

-- Nguồn kinh phí của việc sửa chữa dùng chung DANH MỤC Nguồn kinh phí (`FundingSource`) thay cho ba nguồn riêng
-- (`RepairFunding`, 128): sổ sửa chữa, cải tạo công trình và "Nguồn kinh phí sửa chữa" của phiếu sửa chữa tài sản.
-- Đổi mã cũ: Ngân sách chi thường xuyên (STATE_BUDGET) → Ngân sách (STATE_BUDGET, cùng mã); Nguồn thu hợp pháp của
-- trường (SCHOOL_REVENUE) → Nguồn thu sự nghiệp (REVENUE); Nguồn khác (OTHER) giữ nguyên. "Chưa xác định nguồn" chỉ
-- hệ thống ghi khi ghi tăng, không chọn được ở đây.

--changeset qltb:209-repair-funding-catalog
ALTER TABLE facility_works DROP CONSTRAINT ck_facility_works_funding;
UPDATE facility_works SET funding_source = 'REVENUE' WHERE funding_source = 'SCHOOL_REVENUE';
ALTER TABLE facility_works
    ADD CONSTRAINT ck_facility_works_funding
        CHECK (funding_source IS NULL OR funding_source IN
            ('STATE_BUDGET', 'TUITION', 'REVENUE', 'DEVELOPMENT_FUND', 'SPONSORSHIP', 'OTHER'));
UPDATE repair_orders SET details = jsonb_set(details, '{repairFunding}', '"REVENUE"')
WHERE details ->> 'repairFunding' = 'SCHOOL_REVENUE';
--rollback UPDATE repair_orders SET details = jsonb_set(details, '{repairFunding}', '"SCHOOL_REVENUE"') WHERE details ->> 'repairFunding' = 'REVENUE';
--rollback ALTER TABLE facility_works DROP CONSTRAINT ck_facility_works_funding;
--rollback UPDATE facility_works SET funding_source = 'SCHOOL_REVENUE' WHERE funding_source = 'REVENUE';
--rollback UPDATE facility_works SET funding_source = 'OTHER' WHERE funding_source IN ('TUITION', 'DEVELOPMENT_FUND', 'SPONSORSHIP');
--rollback ALTER TABLE facility_works ADD CONSTRAINT ck_facility_works_funding CHECK (funding_source IS NULL OR funding_source IN ('STATE_BUDGET', 'SCHOOL_REVENUE', 'OTHER'));
