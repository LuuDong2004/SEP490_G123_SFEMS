--liquibase formatted sql

--changeset dth:052-assign-schools-to-ubnd
--comment Chuyển trường Tiểu học và THCS có địa bàn sang UBND phường/xã; THPT giữ ở Sở.

-- Cây quản lý thật: Sở quản lý trực tiếp THPT, còn Tiểu học và THCS thuộc UBND
-- phường/xã. Migration 050 gán TẤT CẢ 946 trường về Sở vì nguồn dữ liệu không
-- nói trường nào thuộc UBND nào. Đây là bước sửa lại phần suy ra được.
--
-- SUY RA ĐƯỢC BAO NHIÊU: cột `ward` của nguồn chỉ có ở 75/946 trường, cộng
-- khoảng 24 trường nữa mà địa chỉ có chứa tên một phường/xã khớp danh mục
-- 2025. Phần còn lại — khoảng 766 trường Tiểu học và THCS — nguồn KHÔNG nói
-- được địa bàn, vì địa chỉ của chúng còn ghi theo phường CŨ trước sáp nhập
-- 01/07/2025, và một phường cũ không map một-một sang phường mới.
--
-- Những trường ấy giữ nguyên ở Sở, và đó là câu trả lời ĐÚNG hơn là đoán: gán
-- bừa theo quận cũ sẽ tạo ra một phân cấp trông như thật mà sai, và phân quyền
-- dòng sẽ THI HÀNH cái sai đó — một UBND thấy trường không thuộc mình, hoặc
-- mất trường thuộc mình. Cây tổng quan vì vậy hiển thị theo đúng cột
-- `department_of_education_id`, nên nó không bao giờ nói dối: trường nào chưa
-- xác định được thì nằm ở nhánh Sở, thấy ngay.

-- ---------------------------------------------------------------- 1. Suy địa bàn từ địa chỉ
-- Chỉ nhận khi địa chỉ khớp ĐÚNG MỘT phường/xã trong danh mục. Khớp nhiều thì
-- bỏ qua: "Phường Tân Hiệp" và "Xã Tân Hiệp" là hai nơi khác nhau, và chọn bừa
-- một trong hai là đặt trường vào sai địa bàn.
--
-- So cả tiền tố ("Phường"/"Xã"/"Đặc khu") chứ không chỉ phần tên riêng, vì
-- phần tên riêng trùng nhau khá nhiều giữa phường và xã.
UPDATE schools s
SET ward_id = m.ward_id
FROM (
    SELECT s2.id AS school_id, min(w.id) AS ward_id
    FROM schools s2
    JOIN wards w ON s2.address ILIKE '%' || w.name || '%'
    WHERE s2.ward_id IS NULL
      AND s2.address IS NOT NULL
    GROUP BY s2.id
    HAVING count(*) = 1
) AS m
WHERE s.id = m.school_id;

-- ---------------------------------------------------------------- 2. Chuyển sang UBND
-- Chỉ Tiểu học và THCS. THPT thuộc Sở bất kể có địa bàn hay không — đó là phân
-- cấp quản lý, không phải chuyện địa lý.
UPDATE schools s
SET department_of_education_id = d.id
FROM wards w
JOIN departments_of_education d ON d.code = 'UBND-' || w.code
JOIN education_levels el ON el.code IN ('TH', 'THCS')
WHERE s.ward_id = w.id
  AND s.education_level_id = el.id
  AND d.type = 'UBND';
