--liquibase formatted sql

--changeset dth:038-assets-in-stock-status
--comment Tai san do phieu nhap sinh ra, chua vao phong nao, thi trang thai la TRONG KHO.

-- Truoc thay doi nay moi tai san sinh ra deu mang 'IN_USE', ke ca khi dang nam
-- trong kho va chua giao cho ai. Chi va nhung dong do PHIEU sinh ra: tai san
-- nhap tay co the da duoc dat trang thai co y, va khong co chung tu nao de doi
-- chieu.
UPDATE equipment
SET status = 'IN_STOCK'
WHERE intake_line_id IS NOT NULL
  AND room_id IS NULL
  AND status = 'IN_USE';
