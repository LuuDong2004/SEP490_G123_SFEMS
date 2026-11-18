--liquibase formatted sql

-- Trường XEM được kế hoạch mua sắm của cấp trên (theo trưởng nhóm): kế hoạch do Sở / UBND đưa ra, trường
-- chỉ thấy bản ĐÃ DUYỆT và chỉ kế hoạch có đề xuất của chính mình — trước đó trường chỉ biết tên kế hoạch
-- qua đề xuất, không mở được kế hoạch.
--
-- Chỉ `read`. Ai thấy kế hoạch nào không nằm ở bảng chính sách phạm vi dòng mà ở mã
-- (`ProcurementPlanService.visible`): tài khoản có trường → kế hoạch APPROVED chứa đề xuất của trường đó,
-- và phần đề xuất / tổng hợp trong kế hoạch chỉ tính đề xuất của trường đó. Nên changelog này chỉ cấp mã quyền.

--changeset qltb:115-school-reads-approved-procurement-plans
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'procurement_plans:read'
WHERE r.code IN ('SCHOOL_LEADER', 'SCHOOL_STAFF')
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
--rollback DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE code IN ('SCHOOL_LEADER', 'SCHOOL_STAFF')) AND permission_id = (SELECT id FROM permissions WHERE code = 'procurement_plans:read');
