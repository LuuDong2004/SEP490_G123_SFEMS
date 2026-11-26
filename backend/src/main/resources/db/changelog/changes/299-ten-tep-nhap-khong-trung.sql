--liquibase formatted sql

--changeset luudong:299-ten-tep-nhap-khong-trung
--comment Lô nhập dữ liệu của cùng trường trùng tên tệp: lô sau thêm (2), (3) trước đuôi tệp như Windows. Lô mới máy chủ tự đặt tên như vậy
WITH d AS (
    SELECT id, file_name,
           row_number() OVER (PARTITION BY school_id, lower(file_name) ORDER BY created_at, id) AS n
    FROM data_import_batches)
UPDATE data_import_batches b
SET file_name = regexp_replace(d.file_name, '(\.[^.]+)?$', ' (' || d.n || ')\1')
FROM d
WHERE b.id = d.id AND d.n > 1;
--rollback SELECT 1;
