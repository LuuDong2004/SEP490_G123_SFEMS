--liquibase formatted sql

--changeset qltb:153-disposal-mockup
-- Phiếu ghi giảm theo mockup mới.
--  * Ghi giảm do mất: ngày phát hiện mất, người liên quan / chịu trách nhiệm, bồi thường (có / không, người bồi
--    thường, số tiền, hình thức). Phiếu phát sinh (mượn trả / kiểm kê) dùng lại cột nguồn sẵn có.
--  * Văn bản, chứng từ bổ sung SAU khi duyệt (công văn, quyết định, biên bản…): danh sách JSONB trên phiếu; phải có
--    một Quyết định có số thì mới hoàn tất ghi giảm.
--  * Lý do của ghi giảm do mất tách thành nguyên nhân cụ thể; lý do "Mất" cũ đổi theo phiếu nguồn.
--  * Hình thức / đơn vị tiêu huỷ thành ô chọn: giá trị gõ tay cũ không khớp danh sách thì thành "Khác", chữ cũ
--    chép vào ghi chú để không mất.
ALTER TABLE disposals
    ADD COLUMN lost_date            DATE,
    ADD COLUMN responsible_staff_id BIGINT REFERENCES staff (id) ON DELETE SET NULL,
    ADD COLUMN compensation         BOOLEAN       NOT NULL DEFAULT FALSE,
    ADD COLUMN compensator_staff_id BIGINT REFERENCES staff (id) ON DELETE SET NULL,
    ADD COLUMN compensation_amount  NUMERIC(18, 2),
    ADD COLUMN compensation_method  VARCHAR(255),
    ADD COLUMN documents            JSONB         NOT NULL DEFAULT '[]'::jsonb,
    ADD CONSTRAINT ck_disposals_compensation CHECK (compensation_amount IS NULL OR compensation_amount >= 0);

UPDATE disposals SET reason = CASE source_resource
        WHEN 'equipment_loans' THEN 'THAT_LAC_KHI_MUON'
        WHEN 'inventory_sessions' THEN 'KHONG_TIM_THAY_KIEM_KE'
        ELSE 'MAT' END
WHERE kind = 'LOSS' AND reason = 'MAT';

UPDATE disposals SET lost_date = proposal_date WHERE kind = 'LOSS';

UPDATE disposals
SET note = LEFT(CONCAT_WS(E'\n', NULLIF(note, ''),
               CASE WHEN details->>'destructionMethod' IS NOT NULL
                         AND details->>'destructionMethod' NOT IN ('BURN', 'BURY', 'CRUSH', 'RECYCLE', 'WASTE_COLLECTION', 'OTHER')
                    THEN 'Hình thức tiêu huỷ: ' || (details->>'destructionMethod') END,
               CASE WHEN details->>'executingUnit' IS NOT NULL
                         AND details->>'executingUnit' NOT IN ('SELF', 'WASTE_COMPANY', 'OTHER')
                    THEN 'Đơn vị tiêu huỷ: ' || (details->>'executingUnit') END), 500),
    details = details
        || CASE WHEN details->>'destructionMethod' IS NOT NULL
                     AND details->>'destructionMethod' NOT IN ('BURN', 'BURY', 'CRUSH', 'RECYCLE', 'WASTE_COLLECTION', 'OTHER')
                THEN '{"destructionMethod": "OTHER"}'::jsonb ELSE '{}'::jsonb END
        || CASE WHEN details->>'executingUnit' IS NOT NULL
                     AND details->>'executingUnit' NOT IN ('SELF', 'WASTE_COMPANY', 'OTHER')
                THEN '{"executingUnit": "OTHER"}'::jsonb ELSE '{}'::jsonb END
WHERE kind = 'DESTRUCTION';

-- "Phòng GD" không còn là một cấp quyết định (chỉ Hiệu trưởng, UBND phường / xã, Sở).
UPDATE disposals SET details = details || '{"approvalAuthority": "PEOPLE_COMMITTEE"}'::jsonb
WHERE details->>'approvalAuthority' = 'EDUCATION_OFFICE';
--rollback UPDATE disposals SET reason = 'MAT' WHERE kind = 'LOSS'; ALTER TABLE disposals DROP CONSTRAINT ck_disposals_compensation, DROP COLUMN documents, DROP COLUMN compensation_method, DROP COLUMN compensation_amount, DROP COLUMN compensator_staff_id, DROP COLUMN compensation, DROP COLUMN responsible_staff_id, DROP COLUMN lost_date;
