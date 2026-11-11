--liquibase formatted sql

--changeset tutn:039-don-vi-tinh-so-le
--comment Đơn vị tính có cờ cho phép số lẻ (DM-01): kg, g, lít, ml, mét chia được; cái, bộ, chai… chỉ đếm số nguyên.

ALTER TABLE units ADD COLUMN allows_fraction boolean DEFAULT false NOT NULL;

-- Đơn vị đo khối lượng, thể tích, chiều dài là chia được.
UPDATE units SET allows_fraction = true WHERE code IN ('KG', 'G', 'L', 'ML', 'M', 'MET');

--rollback ALTER TABLE units DROP COLUMN allows_fraction;
