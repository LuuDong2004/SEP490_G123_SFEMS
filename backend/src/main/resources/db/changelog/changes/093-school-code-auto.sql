--liquibase formatted sql

-- Mã trường tự cấp khi thêm trường: quy tắc sinh mã "schools" (TR0001…), sửa được ở Quản trị hệ
-- thống → Quy tắc sinh mã như mọi danh mục khác. Người khai báo trường giờ chỉ nhập MÃ ĐỊNH DANH
-- BỘ GD&ĐT (moet_code — để liên thông CSDL ngành); mã trường (khoá nội bộ) và mã hai ký tự (thành
-- phần TR của mã tài sản) do hệ thống cấp — xem SchoolService.create.
--
-- Bộ đếm khởi đầu bằng số lớn nhất đang dùng dạng TR + số, để mã đầu tiên không trùng mã có sẵn.

--changeset qltb:093-school-code-auto
INSERT INTO code_rules (code, name, sort_order, active, target, prefix, number_length, current_number, created_at)
SELECT 'SCHOOL', 'Trường học', 11, TRUE, 'schools', 'TR', 4,
       COALESCE((SELECT max(substring(upper(code) FROM '^TR([0-9]{1,18})$')::bigint) FROM schools), 0), now()
WHERE NOT EXISTS (SELECT 1 FROM code_rules WHERE target = 'schools');
--rollback DELETE FROM code_rules WHERE target = 'schools';
