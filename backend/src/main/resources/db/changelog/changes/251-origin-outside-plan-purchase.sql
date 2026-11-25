--liquibase formatted sql

-- Nguồn hình thành thứ bảy: "Mua sắm ngoài kế hoạch" (trưởng nhóm 14/11/2026). Trường tự mua không nằm trong kế
-- hoạch mua sắm (mua gấp, mua lẻ bằng kinh phí tự chủ): vẫn là hàng MUA — đòi nhà cung cấp, số / ngày hoá đơn, đơn giá
-- như "Kế hoạch mua sắm" — nhưng không phải chọn kế hoạch. Trước đây ghi "Khác", báo cáo lẫn với các trường hợp khác.
--
-- Phiếu ghi tăng CHƯA XONG (nháp / chờ duyệt / bị trả lại) đang ở "Kế hoạch mua sắm" mà không đi từ đề xuất nào (lập
-- trước khi bắt buộc chọn kế hoạch) chuyển sang nguồn mới — đúng bản chất và trình được ngay. Phiếu đã ghi tăng giữ
-- nguyên: hồ sơ tài sản đã chép nguồn xuống rồi.

--changeset qltb:251-origin-outside-plan-purchase
INSERT INTO origin_sources (code, name, sort_order, active, created_at)
SELECT 'MUA_NGOAI_KH', 'Mua sắm ngoài kế hoạch', 2, TRUE, now()
WHERE NOT EXISTS (SELECT 1 FROM origin_sources WHERE code = 'MUA_NGOAI_KH');

-- Đứng ngay sau "Kế hoạch mua sắm" trong ô chọn.
UPDATE origin_sources SET sort_order = sort_order + 1, updated_at = now()
WHERE code IN ('PHAN_BO', 'TANG_TAI_TRO', 'KIEM_KE_THUA', 'TU_LAM', 'KHAC');

UPDATE equipment_intakes i
SET origin_source_id = (SELECT id FROM origin_sources WHERE code = 'MUA_NGOAI_KH'), updated_at = now()
WHERE i.origin_source_id = (SELECT id FROM origin_sources WHERE code = 'MUA_SAM')
  AND i.status IN ('DRAFT', 'PENDING', 'REJECTED')
  AND (i.source_resource IS NULL OR i.source_resource <> 'purchase_proposals');
--rollback UPDATE equipment_intakes SET origin_source_id = (SELECT id FROM origin_sources WHERE code = 'MUA_SAM') WHERE origin_source_id = (SELECT id FROM origin_sources WHERE code = 'MUA_NGOAI_KH'); UPDATE origin_sources SET sort_order = sort_order - 1 WHERE code IN ('PHAN_BO', 'TANG_TAI_TRO', 'KIEM_KE_THUA', 'TU_LAM', 'KHAC'); DELETE FROM origin_sources WHERE code = 'MUA_NGOAI_KH';
