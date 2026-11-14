--liquibase formatted sql

--changeset dth:039-managing-body-type
--comment Loại cơ quan chủ quản: Sở quản lý THPT, UBND quản lý Tiểu học và THCS.

-- Không phải mọi trường đều do Sở quản lý. Sở GD&ĐT quản lý trực tiếp các
-- trường THPT; Tiểu học và THCS do UBND phường/xã quản lý, còn Sở quản lý
-- THÔNG QUA UBND. Bảng này vì vậy không còn chỉ là "Phòng GD&ĐT" mà là cơ quan
-- chủ quản nói chung — cột `type` là thứ phân biệt chúng.
--
-- Vì sao một bảng có cột loại, chứ không phải hai bảng riêng: một trường trỏ
-- tới ĐÚNG MỘT cơ quan chủ quản, và câu hỏi "trường này thuộc ai" phải trả lời
-- được bằng một khoá ngoại. Hai bảng nghĩa là hai cột khoá ngoại trên `schools`
-- và một ràng buộc "đúng một trong hai được khác rỗng" — cùng một sự thật, gấp
-- đôi chỗ để sai. Thêm một loại cơ quan thứ tư sau này chỉ là thêm một giá trị
-- vào CHECK, không phải thêm một bảng và một nhánh phân quyền.
--
-- Tên bảng giữ nguyên `departments_of_education`. Đổi tên sẽ kéo theo đường dẫn
-- API, ba mã quyền và tên tài nguyên ở frontend — nhiều rủi ro, không đổi được
-- hành vi nào. Nhãn tiếng Việt trên giao diện mới là thứ người dùng đọc, và
-- nhãn đó đã đổi thành "Cơ quan chủ quản".
ALTER TABLE departments_of_education ADD COLUMN type VARCHAR(32);

-- Dòng duy nhất đang có là Sở GD&ĐT TP.HCM (seed 015). Gán tường minh thay vì
-- đặt DEFAULT: một giá trị mặc định ở đây sẽ âm thầm gán loại sai cho mọi dòng
-- thêm về sau mà quên khai báo, và loại sai nghĩa là phạm vi dữ liệu sai.
UPDATE departments_of_education SET type = 'SO' WHERE type IS NULL;

ALTER TABLE departments_of_education ALTER COLUMN type SET NOT NULL;

ALTER TABLE departments_of_education
    ADD CONSTRAINT ck_departments_of_education_type
        CHECK (type IN ('SO', 'UBND', 'KHAC'));

-- "Các UBND" và "các Sở" là hai câu hỏi mà màn hình lẫn chính sách phạm vi dữ
-- liệu đều hỏi thường xuyên.
CREATE INDEX idx_departments_of_education_type ON departments_of_education (type);
