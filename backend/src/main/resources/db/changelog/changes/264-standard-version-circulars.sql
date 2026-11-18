--liquibase formatted sql

--changeset luudong:264-standard-version-circulars
-- Phiên bản của bộ gọi theo số thông tư đã gộp vào nó ("TT 37/2021 + 26/2023"), không "2021, sửa đổi 2023" (trưởng
-- nhóm 16/11/2026: khó hiểu). Cùng cách với EquipmentStandardService.versionOf: căn cứ chính, sửa đổi, đính chính
-- (tiền tố "ĐC") theo thứ tự; số "37/2021/TT-BGDĐT" viết gọn "37/2021".
UPDATE equipment_standards s
SET standard_version = LEFT('TT ' || v.chain, 50)
FROM (SELECT d.standard_id,
             string_agg(CASE WHEN d.document_role = 'CORRECTION' THEN 'ĐC ' ELSE '' END
                            || COALESCE(substring(trim(d.document_no) FROM '^(\d+/\d{4})(?:/|$)'), trim(d.document_no)),
                        ' + ' ORDER BY d.sort_order, d.id) AS chain
      FROM equipment_standard_documents d
      WHERE d.document_role IN ('MAIN', 'AMENDMENT', 'CORRECTION')
      GROUP BY d.standard_id) v
WHERE v.standard_id = s.id
  AND EXISTS (SELECT 1 FROM equipment_standard_documents m WHERE m.standard_id = s.id AND m.document_role = 'MAIN');
