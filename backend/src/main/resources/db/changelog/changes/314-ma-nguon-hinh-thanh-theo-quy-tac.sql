--liquibase formatted sql

--changeset luudong:314-ma-nguon-hinh-thanh-theo-quy-tac splitStatements:false
--comment Nguồn hình thành đổi mã sang mã của quy tắc sinh mã (NG001…) như 312. Mã chữ cũ (MUA_SAM, PHAN_BO, KIEM_KE_THUA…) là tên luật OriginRule, chuyển sang khoá hệ thống system_key — luật phiếu ghi tăng đọc khoá, không đọc mã. Danh mục vẫn cố định: không thêm, không xoá.
ALTER TABLE origin_sources ADD COLUMN system_key VARCHAR(64);
UPDATE origin_sources SET system_key = code;
ALTER TABLE origin_sources ADD CONSTRAINT uq_origin_sources_system_key UNIQUE (system_key);
UPDATE origin_sources o SET code = r.prefix || lpad(x.n::text, r.number_length, '0') || COALESCE(r.suffix, ''),
    updated_at = now()
FROM (SELECT id, row_number() OVER (ORDER BY sort_order NULLS LAST, id) AS n FROM origin_sources) x,
     code_rules r
WHERE x.id = o.id AND r.target = 'origin_sources';
UPDATE code_rules SET current_number = (SELECT count(*) FROM origin_sources), updated_at = now()
WHERE target = 'origin_sources';
--rollback UPDATE origin_sources SET code = system_key WHERE system_key IS NOT NULL;
--rollback UPDATE code_rules SET current_number = 0 WHERE target = 'origin_sources';
--rollback ALTER TABLE origin_sources DROP COLUMN system_key;
