--liquibase formatted sql

--changeset dth:045-school-moet-code
--comment Tách mã định danh Bộ GD&ĐT khỏi mã hai ký tự dùng để sinh mã tài sản.

-- Cột `emis_code` đang dài 2 ký tự và được chú thích là "mã EMIS của Bộ GD&ĐT".
-- Chú thích đó SAI, và cái sai này chỉ lộ ra ở giai đoạn tích hợp nếu không
-- sửa bây giờ.
--
-- Mã định danh cơ sở giáo dục thật của Bộ — trường "Mã trường (học)" trên CSDL
-- ngành (csdl.moet.gov.vn) — dài **20 ký tự**, ghép từ mã tỉnh + mã huyện + mã
-- đơn vị, duy nhất và BẤT BIẾN từ lần nhập đầu tiên. Hai ký tự không thể là
-- nó.
--
-- Cái 2 ký tự đang có thực ra là thành phần `TR` của quy tắc sinh mã tài sản
-- `TT.TR.MH.LT.ST.NC` — một mã nội bộ để mã tài sản đủ ngắn mà đọc được. Nó
-- có lý do tồn tại, chỉ là không phải thứ nó đang tự nhận.
--
-- Hai thứ khác nhau thì phải là hai cột. Gộp lại thì đến lúc liên thông với
-- CSDL ngành (Chương V mục 3.8.1) sẽ phải ghép dữ liệu theo TÊN TRƯỜNG — thứ
-- chắc chắn lệch, và lệch âm thầm.

-- Đổi tên cho đúng việc nó làm.
ALTER TABLE schools RENAME COLUMN emis_code TO short_code;

-- Mã định danh Bộ GD&ĐT.
--
-- Cho phép rỗng: một trường vừa khai báo trong hệ thống này chưa chắc đã có mã
-- trên CSDL ngành, và bắt buộc sẽ chặn luôn việc khai báo. Rỗng nghĩa là "chưa
-- liên thông được", và đó là một trạng thái có thật cần đọc ra được.
--
-- UNIQUE vì mã là bất biến và duy nhất toàn quốc — hai trường mang cùng một mã
-- là một lỗi nhập liệu, không phải một trường hợp nghiệp vụ.
ALTER TABLE schools ADD COLUMN moet_code VARCHAR(20);

ALTER TABLE schools
    ADD CONSTRAINT uq_schools_moet_code UNIQUE (moet_code);

-- "Trường nào chưa có mã ngành" là câu hỏi của người đi đối soát trước khi
-- tích hợp, và "tìm trường theo mã ngành" là câu hỏi của chính trình tích hợp.
CREATE INDEX idx_schools_moet_code ON schools (moet_code);
