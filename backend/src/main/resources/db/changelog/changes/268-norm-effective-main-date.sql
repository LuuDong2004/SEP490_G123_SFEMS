--liquibase formatted sql

--changeset luudong:268-norm-effective-main-date splitStatements:false
-- 267 lấy ngày bắt đầu theo văn bản căn cứ của dòng — với bộ nạp từ văn bản HỢP NHẤT (VBHN, vai trò tham khảo) đó là
-- ngày ký văn bản hợp nhất (2024), không phải ngày thông tư gốc có hiệu lực. Dòng có sẵn (không thay dòng nào) mà căn cứ
-- không phải văn bản sửa đổi thì bắt đầu từ ngày hiệu lực của văn bản CHÍNH của bộ (TT 37, 38, 39/2021: 14/02/2022).
UPDATE equipment_norms n SET effective_from = m.start_date
FROM (
    SELECT DISTINCT ON (d.standard_id) d.standard_id, COALESCE(d.effective_date, d.issue_date) AS start_date
    FROM equipment_standard_documents d
    WHERE d.document_role = 'MAIN' AND COALESCE(d.effective_date, d.issue_date) IS NOT NULL
    ORDER BY d.standard_id, d.sort_order NULLS LAST, d.id
) m
WHERE m.standard_id = n.standard_id
  AND n.replaces_norm_id IS NULL
  AND n.effective_from > m.start_date
  AND (n.effective_to IS NULL OR n.effective_to > m.start_date)
  AND NOT EXISTS (SELECT 1 FROM equipment_standard_documents s
                  WHERE s.id = n.source_document_id AND s.document_role IN ('AMENDMENT', 'CORRECTION'));
--rollback SELECT 1;
