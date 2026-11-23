--liquibase formatted sql

--changeset luudong:269-norm-basis-by-circular splitStatements:false
-- Căn cứ từng dòng của danh mục tối thiểu theo ĐÚNG thông tư (trưởng nhóm 17/11/2026): bộ nạp từ văn bản hợp nhất
-- (02, 03, 06/VBHN — chỉ gom nội dung, không phải căn cứ) nên mọi dòng đang trỏ về VBHN. TT 26/2023 chỉ sửa đổi, bổ sung
-- 49 mục (Điều 1–3 của thông tư, đối chiếu tên + số thứ tự trong phụ lục): các dòng đó căn cứ TT 26/2023, áp dụng từ
-- 12/02/2024; mọi dòng khác căn cứ thông tư gốc của bộ (TT 37, 38, 39/2021).
UPDATE equipment_norms n SET source_document_id = d.id
FROM equipment_standard_documents d
WHERE d.standard_id = n.standard_id
  AND d.document_role = 'MAIN'
  AND n.source_document_id IN (SELECT id FROM equipment_standard_documents WHERE document_role = 'REFERENCE')
  AND n.code NOT IN ('DM-TH-25-009','DM-TH-28-004','DM-THCS-00-013','DM-THCS-08-003','DM-THCS-17-030','DM-THCS-18-001','DM-THCS-18-004','DM-THCS-18-007','DM-THCS-18-040','DM-THCS-18-061','DM-THCS-18-066','DM-THCS-18-078','DM-THCS-19-003','DM-THCS-19-010','DM-THCS-21-034','DM-THCS-27-004','DM-THCS-27-020','DM-THCS-27-037','DM-THCS-27-040','DM-THCS-27-130','DM-THCS-27-142','DM-THCS-27-146','DM-THCS-27-153','DM-THCS-27-159','DM-THCS-27-160','DM-THCS-27-237','DM-THPT-11-003','DM-THPT-11-013','DM-THPT-11-014','DM-THPT-11-015','DM-THPT-11-016','DM-THPT-11-018','DM-THPT-11-024','DM-THPT-11-025','DM-THPT-11-026','DM-THPT-11-028','DM-THPT-11-030','DM-THPT-11-040','DM-THPT-12-039','DM-THPT-12-041','DM-THPT-13-064','DM-THPT-18-002','DM-THPT-19-003','DM-THPT-19-006','DM-THPT-19-008','DM-THPT-19-010','DM-THPT-21-031','DM-THPT-21-041','DM-THPT-21-042');

UPDATE equipment_norms n SET source_document_id = d.id,
       effective_from = COALESCE(d.effective_date, d.issue_date)
FROM equipment_standard_documents d
WHERE d.standard_id = n.standard_id
  AND d.document_role = 'AMENDMENT'
  AND d.document_no = '26/2023/TT-BGDĐT'
  AND n.code IN ('DM-TH-25-009','DM-TH-28-004','DM-THCS-00-013','DM-THCS-08-003','DM-THCS-17-030','DM-THCS-18-001','DM-THCS-18-004','DM-THCS-18-007','DM-THCS-18-040','DM-THCS-18-061','DM-THCS-18-066','DM-THCS-18-078','DM-THCS-19-003','DM-THCS-19-010','DM-THCS-21-034','DM-THCS-27-004','DM-THCS-27-020','DM-THCS-27-037','DM-THCS-27-040','DM-THCS-27-130','DM-THCS-27-142','DM-THCS-27-146','DM-THCS-27-153','DM-THCS-27-159','DM-THCS-27-160','DM-THCS-27-237','DM-THPT-11-003','DM-THPT-11-013','DM-THPT-11-014','DM-THPT-11-015','DM-THPT-11-016','DM-THPT-11-018','DM-THPT-11-024','DM-THPT-11-025','DM-THPT-11-026','DM-THPT-11-028','DM-THPT-11-030','DM-THPT-11-040','DM-THPT-12-039','DM-THPT-12-041','DM-THPT-13-064','DM-THPT-18-002','DM-THPT-19-003','DM-THPT-19-006','DM-THPT-19-008','DM-THPT-19-010','DM-THPT-21-031','DM-THPT-21-041','DM-THPT-21-042');
