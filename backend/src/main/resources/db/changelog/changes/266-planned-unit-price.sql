--liquibase formatted sql

--changeset luudong:266-planned-unit-price
-- Đơn giá do cơ quan lập kế hoạch mua sắm xác định (Sở / UBND). Trường đề xuất nhu cầu, đơn giá dự kiến của trường
-- KHÔNG bắt buộc (trường thường chưa biết giá); cơ quan nhập / sửa đơn giá trên màn kế hoạch, kế hoạch chỉ trình /
-- duyệt được khi mọi dòng đưa vào kế hoạch có giá. NULL: theo đơn giá trường ghi (unit_price). Giữ riêng cột để không
-- ghi đè con số của trường.
ALTER TABLE purchase_proposal_lines ADD COLUMN IF NOT EXISTS planned_unit_price NUMERIC(18, 2);
