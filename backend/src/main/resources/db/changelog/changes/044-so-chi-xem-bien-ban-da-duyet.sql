--liquibase formatted sql

--changeset tutn:044-so-chi-xem-bien-ban-da-duyet
--comment Sở chỉ xem biên bản kiểm kê trường đã duyệt xong (KK-02): biên bản còn nháp hoặc đang chờ hiệu trưởng là việc của trường.

-- Biên bản kiểm kê chỉ cần lãnh đạo trường duyệt. Trước đây Sở đọc mọi biên bản của mọi trường, kể cả bản
-- tổ kiểm kê đang đếm dở. Nay Sở chỉ đọc biên bản đã duyệt, đã hoàn tất; màn tiến độ đợt vẫn hiện trạng thái
-- và số phiếu của mọi trường, chỉ không gắn đường dẫn tới biên bản chưa mở được.
UPDATE row_level_policy p
SET scope = '{"op": "in", "field": "status", "value": {"lit": ["APPROVED", "COMPLETED"]}}'::jsonb,
    name = 'Sở xem biên bản trường đã duyệt',
    description = 'Sở GD&ĐT xem biên bản kiểm kê của mọi trường sau khi lãnh đạo trường đã duyệt.',
    updated_at = now()
FROM roles r
WHERE r.id = p.role_id AND r.code IN ('SO_LEADER', 'SO_SPECIALIST')
  AND p.kind = 'SCOPE' AND p.resource = 'inventory_sessions' AND p.action = 'read';
--rollback UPDATE row_level_policy p SET scope = '{"all": []}'::jsonb, name = 'Sở xem mọi trường', description = 'Sở GD&ĐT tổng hợp dữ liệu toàn ngành.' FROM roles r WHERE r.id = p.role_id AND r.code IN ('SO_LEADER', 'SO_SPECIALIST') AND p.kind = 'SCOPE' AND p.resource = 'inventory_sessions' AND p.action = 'read';
