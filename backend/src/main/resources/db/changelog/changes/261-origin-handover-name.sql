--liquibase formatted sql

--changeset luudong:261-origin-handover-name
-- "Được điều chuyển" → "Được cấp phát, bàn giao" (15/11/2026): nguồn này là tài sản cấp trên giao về theo quyết định —
-- Sở / Phòng / UBND mua sắm tập trung rồi bàn giao, dự án giao về, đơn vị không dùng hệ thống chuyển sang. Tên cũ trùng
-- chữ với nghiệp vụ điều chuyển giữa các trường trên hệ thống (phiếu điều chuyển, trường nhận xác nhận ở đó, không ghi
-- tăng), người dùng tưởng phải chọn phiếu điều chuyển ở đây. Mã giữ nguyên. Tên phải khớp OriginRule.label().
UPDATE origin_sources SET name = 'Được cấp phát, bàn giao', updated_at = now() WHERE code = 'PHAN_BO';
--rollback UPDATE origin_sources SET name = 'Được điều chuyển', updated_at = now() WHERE code = 'PHAN_BO';
