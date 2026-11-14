--liquibase formatted sql

-- Luồng phê duyệt: chỉ QUẢN TRỊ VIÊN sửa được, chuyên viên Sở chỉ xem.
--
-- Changelog 110 cấp `approval_flows:write` cho cả SO_SPECIALIST. Nhưng đổi luồng duyệt là đổi AI KÝ phiếu
-- nào — quyết định của lãnh đạo, không phải của chuyên viên — và một luồng áp cho mọi trường, kể cả trường
-- Tiểu học, THCS do UBND quản lý, nơi Sở chỉ đọc (`docs/phantich/00-actor-va-phan-quyen.md`). Tạm thời luồng
-- duyệt là cấu hình hệ thống: lãnh đạo quyết bằng văn bản, quản trị viên nhập vào. Chuyên viên Sở giữ
-- `approval_flows:read` để vẫn xem được luồng đang áp dụng.

--changeset qltb:120-approval-flows-admin-only
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.code = 'SO_SPECIALIST' AND p.code = 'approval_flows:write';
