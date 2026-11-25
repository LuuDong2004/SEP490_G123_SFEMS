--liquibase formatted sql

-- Nguồn hình thành MUA_NGOAI_KH (251) đổi tên "Mua sắm ngoài kế hoạch" → "Trường tự mua sắm" (trưởng nhóm 14/11/2026):
-- nói thẳng ai mua, không đặt nó thành "ngoại lệ" của kế hoạch. Mã và luật giữ nguyên (`OriginRule.MUA_NGOAI_KH`).

--changeset luudong:258-origin-school-purchase-name
UPDATE origin_sources SET name = 'Trường tự mua sắm', updated_at = now() WHERE code = 'MUA_NGOAI_KH';
--rollback UPDATE origin_sources SET name = 'Mua sắm ngoài kế hoạch' WHERE code = 'MUA_NGOAI_KH';
