--liquibase formatted sql

--changeset qltb:174-inventory-session-campaign-dedupe
-- Mỗi trường một biên bản còn hiệu lực cho một đợt kiểm kê — trước đây chỉ kiểm bằng code, không khoá, nên bấm "Lập
-- phiếu cho đợt này" hai lần nhanh ra hai biên bản. Dọn trước khi đặt unique: trong mỗi (trường, đợt) giữ phiếu đã đi
-- xa nhất (đã trình / duyệt / xong trước nháp), cùng mức thì phiếu lập trước; các phiếu NHÁP còn lại thành đã huỷ.
-- Phiếu thừa đã trình thì không tự huỷ — bước dưới bỏ qua cho tới khi có người xử lý.
UPDATE inventory_sessions s
SET status = 'CANCELLED',
    cancel_reason = 'Trùng biên bản của trường cho cùng đợt kiểm kê — tự huỷ khi thêm ràng buộc một biên bản một đợt',
    updated_at = now()
FROM (
    SELECT id, row_number() OVER (PARTITION BY school_id, campaign_id
                                  ORDER BY CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END, id) AS rn
    FROM inventory_sessions
    WHERE campaign_id IS NOT NULL AND status NOT IN ('CANCELLED', 'REJECTED')
) ranked
WHERE s.id = ranked.id AND ranked.rn > 1 AND s.status = 'DRAFT';

--changeset qltb:174-inventory-session-campaign-unique
--preconditions onFail:CONTINUE
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM (SELECT 1 FROM inventory_sessions WHERE campaign_id IS NOT NULL AND status NOT IN ('CANCELLED', 'REJECTED') GROUP BY school_id, campaign_id HAVING COUNT(*) > 1) d
-- Còn trùng (phiếu thừa đã trình) thì Liquibase bỏ qua bước này và thử lại ở lần khởi động sau, khi đã xử lý xong.
CREATE UNIQUE INDEX uq_inventory_sessions_school_campaign
    ON inventory_sessions (school_id, campaign_id)
    WHERE campaign_id IS NOT NULL AND status NOT IN ('CANCELLED', 'REJECTED');
