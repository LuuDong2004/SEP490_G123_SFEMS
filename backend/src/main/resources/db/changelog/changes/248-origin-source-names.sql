--liquibase formatted sql

--changeset qltb:248-origin-source-names
-- Tên nguồn hình thành theo nghiệp vụ (trưởng nhóm 13/11/2026): "Mua sắm" → "Kế hoạch mua sắm" (hàng mua theo kế
-- hoạch, đề xuất mua sắm của trường); "Được Sở phân bổ" → "Được điều chuyển" (tài sản nhận theo quyết định điều chuyển).
-- Mã giữ nguyên — phiếu, tài sản trỏ tới các dòng này không đổi. Tên phải khớp OriginRule.label().
UPDATE origin_sources SET name = 'Kế hoạch mua sắm', updated_at = now() WHERE code = 'MUA_SAM';
UPDATE origin_sources SET name = 'Được điều chuyển', updated_at = now() WHERE code = 'PHAN_BO';
--rollback UPDATE origin_sources SET name = 'Mua sắm', updated_at = now() WHERE code = 'MUA_SAM';
--rollback UPDATE origin_sources SET name = 'Được Sở phân bổ', updated_at = now() WHERE code = 'PHAN_BO';
