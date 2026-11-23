--liquibase formatted sql

--changeset dth:051-seed-ubnd
--comment 168 UBND phường/xã/đặc khu — cơ quan chủ quản của trường Tiểu học và THCS.

-- Migration 046 từng tạo 168 UBND nhưng gắn nhãn DEMO, và 050 xoá chúng cùng
-- dữ liệu demo. Lần này là dữ liệu THẬT: mỗi phường/xã của TP.HCM sau sáp nhập
-- 01/07/2025 có một UBND, và đó là cơ quan chủ quản của các trường Tiểu học,
-- THCS trên địa bàn. Không có dòng nào ở đây thì:
--
--   · Màn "Sở/Phòng Giáo dục" chỉ có đúng một dòng là Sở
--   · Không tạo được tài khoản UBND, nên không kiểm chứng được chính sách
--     "UBND chỉ thấy trường trên địa bàn mình"
--   · Cột "Cơ quan chủ quản" trên form trường chỉ có một lựa chọn
--
-- Tên lấy từ danh mục `wards` (168 dòng, nguồn provinces.open-api.vn mã tỉnh
-- 79) nên nó theo đúng địa giới hiện hành: 113 phường, 54 xã, 1 đặc khu.
-- Không viết tay danh sách — sinh từ danh mục thì đổi địa giới chỉ cần đổi
-- danh mục.
--
-- Mã: UBND-<mã hành chính>. Mã hành chính là của Tổng cục Thống kê, ổn định và
-- duy nhất, nên không có hai UBND nào trùng mã kể cả khi hai phường trùng tên.
INSERT INTO departments_of_education (code, name, province, type, status, created_at)
SELECT 'UBND-' || w.code,
       'UBND ' || w.name,
       'Thành phố Hồ Chí Minh',
       'UBND',
       'ACTIVE',
       now()
FROM wards w
WHERE NOT EXISTS (
    SELECT 1 FROM departments_of_education d WHERE d.code = 'UBND-' || w.code);

-- KHÔNG chuyển trường nào sang UBND ở đây, và đó là cố ý.
--
-- Nguồn dữ liệu trường của Sở không nói trường nào thuộc UBND nào, và cột
-- `ward` chỉ có ở 75 trong 946 trường nên không suy ra được. Gán bừa theo quận
-- cũ sẽ tạo ra một phân cấp quản lý trông như thật mà sai — thứ không ai phát
-- hiện bằng mắt, và là đúng loại sai mà phân quyền dòng sẽ thi hành.
--
-- Khi Sở cung cấp bảng phân cấp quản lý thì chuyển bằng một UPDATE:
--   UPDATE schools SET department_of_education_id = (...) WHERE ...;
