--liquibase formatted sql

--changeset luudong:301-de-xuat-bo-truong-ngoai-nghiep-vu
--comment Đề xuất mua sắm là trường xin Sở cấp kinh phí: nguồn kinh phí do Sở quyết định khi lập kế hoạch, không do trường chọn. Bỏ nguồn kinh phí dự kiến, mức ưu tiên, thông số kỹ thuật của dòng và các trường chứng từ cần trước ngày, cơ sở báo giá, chi tiết thêm của dòng (thương hiệu / xuất xứ, khối lớp, bảng thông số, phụ kiện).
ALTER TABLE purchase_proposals DROP COLUMN funding_source;
ALTER TABLE purchase_proposal_lines DROP COLUMN priority;
ALTER TABLE purchase_proposal_lines DROP COLUMN specification;
UPDATE purchase_proposals SET details = details - 'neededByDate' - 'priceBasis'
    WHERE details -> 'neededByDate' IS NOT NULL OR details -> 'priceBasis' IS NOT NULL;
UPDATE purchase_proposal_lines SET details = '{}'::jsonb WHERE details <> '{}'::jsonb;
