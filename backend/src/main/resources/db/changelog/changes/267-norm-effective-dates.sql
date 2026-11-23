--liquibase formatted sql

--changeset luudong:267-norm-effective-dates splitStatements:false
-- Danh mục thiết bị tối thiểu KHÔNG còn phiên bản / bản nháp (trưởng nhóm 17/11/2026, cách 1): mỗi cấp học một bộ,
-- mỗi DÒNG có hiệu lực từ ngày … đến ngày …, mọi thêm / sửa / bỏ ghi theo văn bản căn cứ.
--   effective_from: ngày dòng bắt đầu áp dụng (bắt buộc).
--   effective_to:   ngày dòng thôi áp dụng (không tính ngày này); trống = còn áp dụng.
--   replaces_norm_id: dòng này thay dòng nào (sửa = đóng dòng cũ, mở dòng mới cùng mã) — lịch sử của một thiết bị.
--   end_document_id: văn bản căn cứ của lần bỏ / thay.
-- Bản nháp đang có (TT 16/2026) được gộp vào bộ đang áp dụng lúc khởi động (StandardDraftFold).
ALTER TABLE equipment_norms
    ADD COLUMN effective_from   DATE,
    ADD COLUMN effective_to     DATE,
    ADD COLUMN replaces_norm_id BIGINT REFERENCES equipment_norms (id) ON DELETE SET NULL,
    ADD COLUMN end_document_id  BIGINT REFERENCES equipment_standard_documents (id) ON DELETE SET NULL;

-- Ngày bắt đầu của dòng có sẵn: hiệu lực của văn bản căn cứ của dòng, không có thì của văn bản chính của bộ, rồi
-- ngày bộ được áp dụng / lập.
UPDATE equipment_norms n SET effective_from = COALESCE(
    (SELECT COALESCE(d.effective_date, d.issue_date) FROM equipment_standard_documents d WHERE d.id = n.source_document_id),
    (SELECT COALESCE(d.effective_date, d.issue_date) FROM equipment_standard_documents d
      WHERE d.standard_id = n.standard_id AND d.document_role = 'MAIN' ORDER BY d.sort_order NULLS LAST, d.id LIMIT 1),
    (SELECT s.applied_at::date FROM equipment_standards s WHERE s.id = n.standard_id),
    n.created_at::date);

-- Dòng của bộ đã hết hiệu lực: thôi áp dụng từ lúc bộ đó hết hiệu lực.
UPDATE equipment_norms n SET effective_to = s.retired_at::date
FROM equipment_standards s
WHERE s.id = n.standard_id AND s.status = 'RETIRED' AND s.retired_at IS NOT NULL
  AND s.retired_at::date > n.effective_from;

ALTER TABLE equipment_norms ALTER COLUMN effective_from SET NOT NULL;
ALTER TABLE equipment_norms ADD CONSTRAINT ck_equipment_norms_effective
    CHECK (effective_to IS NULL OR effective_to > effective_from);

-- Cùng mã = cùng một thiết bị qua các lần sửa: mã duy nhất theo (bộ, mã, ngày bắt đầu).
DROP INDEX IF EXISTS uq_equipment_norms_standard_code;
CREATE UNIQUE INDEX uq_equipment_norms_standard_code ON equipment_norms (standard_id, code, effective_from);
CREATE INDEX ix_equipment_norms_effective ON equipment_norms (standard_id, effective_from, effective_to);
CREATE INDEX ix_equipment_norms_replaces ON equipment_norms (replaces_norm_id);
--rollback DROP INDEX IF EXISTS ix_equipment_norms_replaces;
--rollback DROP INDEX IF EXISTS ix_equipment_norms_effective;
--rollback DROP INDEX IF EXISTS uq_equipment_norms_standard_code;
--rollback CREATE UNIQUE INDEX uq_equipment_norms_standard_code ON equipment_norms (standard_id, code);
--rollback ALTER TABLE equipment_norms DROP CONSTRAINT IF EXISTS ck_equipment_norms_effective;
--rollback ALTER TABLE equipment_norms DROP COLUMN end_document_id, DROP COLUMN replaces_norm_id, DROP COLUMN effective_to, DROP COLUMN effective_from;
