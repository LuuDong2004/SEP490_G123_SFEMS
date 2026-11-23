--liquibase formatted sql

--changeset dth:053-school-department-nullable
--comment Cơ quan chủ quản được phép rỗng; gỡ 742 trường TH/THCS khỏi Sở vì Sở không quản cấp 1, cấp 2.

-- Phân cấp quản lý nhà nước:
--   · Sở GD&ĐT   — quản lý trực tiếp THPT và các trung tâm GDTX
--   · UBND cấp quận/huyện, hoặc cấp xã theo phân cấp mới — quản lý mầm non,
--     tiểu học và THCS trên địa bàn
--
-- Migration 050 gán TẤT CẢ 946 trường về Sở, và 052 chỉ chuyển được 96 trường
-- sang UBND. Còn lại 742 trường tiểu học và THCS vẫn ghi là thuộc Sở — điều đó
-- SAI theo phân cấp trên.
--
-- Cái sai ấy tệ hơn một chỗ trống: hệ thống đang KHẲNG ĐỊNH một điều không
-- đúng, thay vì thừa nhận là chưa biết. Không ai nhìn một bảng 850 dòng mà
-- nhận ra 742 trong đó bị gán nhầm; còn một con số "742 trường chưa xác định
-- cơ quan chủ quản" thì ai cũng thấy ngay là việc phải xử lý.
--
-- Rỗng còn là hành vi ĐÚNG với phân quyền dòng: `user.managingBodyId` so với
-- một khoá ngoại rỗng cho ra UNKNOWN, và UNKNOWN bị xử như TỪ CHỐI — nên không
-- UBND nào vô tình thấy trường chưa xác định thuộc về mình. Fail closed.

ALTER TABLE schools ALTER COLUMN department_of_education_id DROP NOT NULL;

-- Chỉ gỡ tiểu học và THCS đang treo ở Sở. THPT giữ nguyên: Sở quản lý trực
-- tiếp cấp 3, nên đó là sự thật chứ không phải mặc định.
UPDATE schools s
SET department_of_education_id = NULL
FROM departments_of_education d, education_levels el
WHERE d.id = s.department_of_education_id
  AND d.type = 'SO'
  AND el.id = s.education_level_id
  AND el.code IN ('TH', 'THCS');

-- "Trường nào chưa có cơ quan chủ quản" là câu hỏi mà cả màn tổng quan lẫn
-- người đi đối soát dữ liệu đều hỏi, và nó quét một phần lớn bảng.
CREATE INDEX idx_schools_unassigned_department
    ON schools (education_level_id)
    WHERE department_of_education_id IS NULL;
