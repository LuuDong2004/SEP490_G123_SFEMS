--liquibase formatted sql

-- Kế hoạch mua sắm đi theo DÒNG THIẾT BỊ của đề xuất, không theo cả phiếu.
--
-- Trước đây đưa một đề xuất vào kế hoạch là nhận nguyên phiếu: cơ quan không bớt được số lượng hay bỏ được
-- một thiết bị khi ngân sách không đủ, và lúc hàng về, phiếu ghi tăng lấy đủ số trường XIN chứ không phải số
-- cơ quan ĐỊNH MUA. Giờ mỗi dòng của đề xuất trong kế hoạch mang `planned_quantity` — số đưa vào kế hoạch,
-- từ 0 (bỏ dòng) tới số đề nghị; phiếu ghi tăng lập từ đề xuất đọc số này. NULL = đề xuất chưa vào kế hoạch.
-- Phần bớt không chuyển sang kế hoạch sau: một đề xuất nằm trong một kế hoạch, trường cần thì đề xuất lại.
--
-- Kế hoạch có thêm MÃ (KHMS-<năm ngân sách>-<số>, máy cấp lúc lập) và NGÀY LẬP.

--changeset qltb:126-procurement-plan-lines
ALTER TABLE purchase_proposal_lines
    ADD COLUMN planned_quantity INTEGER CHECK (planned_quantity IS NULL OR planned_quantity >= 0);

-- Đề xuất đã nằm trong kế hoạch: trước đây là nhận đủ số đề nghị.
UPDATE purchase_proposal_lines l
SET planned_quantity = l.quantity
FROM purchase_proposals p
WHERE p.id = l.proposal_id AND p.plan_id IS NOT NULL;

ALTER TABLE procurement_plans
    ADD COLUMN code VARCHAR(30),
    ADD COLUMN plan_date DATE;

UPDATE procurement_plans p
SET code = 'KHMS-' || p.budget_year || '-' || lpad(x.n::text, 3, '0'),
    plan_date = (p.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
FROM (SELECT id, row_number() OVER (PARTITION BY budget_year ORDER BY id) AS n FROM procurement_plans) x
WHERE x.id = p.id;

ALTER TABLE procurement_plans
    ALTER COLUMN code SET NOT NULL,
    ALTER COLUMN plan_date SET NOT NULL,
    ADD CONSTRAINT uq_procurement_plans_code UNIQUE (code);


--changeset qltb:126-procurement-plan-school-year
-- Kế hoạch theo NĂM HỌC (hiện "2026-2027"), không theo một con số năm. Năm ngân sách vẫn giữ — đề xuất của
-- trường và màn tổng hợp lọc theo nó — và từ nay tính từ năm học: năm kết thúc của năm học (2026-2027 → 2027).
-- Kế hoạch cũ nhận năm học kết thúc trong năm ngân sách của nó.
ALTER TABLE procurement_plans ADD COLUMN school_year_id BIGINT REFERENCES school_years (id);

UPDATE procurement_plans p
SET school_year_id = (SELECT y.id FROM school_years y
                      WHERE extract(year FROM y.end_date) = p.budget_year
                      ORDER BY y.end_date DESC LIMIT 1);
