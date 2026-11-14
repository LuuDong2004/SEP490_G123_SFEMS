--liquibase formatted sql

-- Nguồn kinh phí của sổ sửa chữa, cải tạo công trình thành ô CHỌN (QLTB-471): ba nguồn của một lần sửa
-- chữa — Ngân sách chi thường xuyên · Nguồn thu hợp pháp của trường · Nguồn khác (`RepairFunding`, cùng ba
-- mã với "Nguồn kinh phí sửa chữa" của phiếu sửa chữa, QLTB-476). Trước đó là ô chữ tự do: giá trị đã gõ
-- không khớp mã nào được chép sang ghi chú (không mất chữ) rồi để trống.

--changeset qltb:128-facility-work-funding
UPDATE facility_works
SET note = LEFT(CONCAT_WS(' · ', NULLIF(TRIM(note), ''), 'Nguồn kinh phí: ' || TRIM(funding_source)), 500)
WHERE NULLIF(TRIM(funding_source), '') IS NOT NULL
  AND funding_source NOT IN ('STATE_BUDGET', 'SCHOOL_REVENUE', 'OTHER');

UPDATE facility_works
SET funding_source = NULL
WHERE funding_source IS NOT NULL
  AND funding_source NOT IN ('STATE_BUDGET', 'SCHOOL_REVENUE', 'OTHER');

ALTER TABLE facility_works
    ADD CONSTRAINT ck_facility_works_funding
        CHECK (funding_source IS NULL OR funding_source IN ('STATE_BUDGET', 'SCHOOL_REVENUE', 'OTHER'));
