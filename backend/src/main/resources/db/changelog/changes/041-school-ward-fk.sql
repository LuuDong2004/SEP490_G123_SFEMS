--liquibase formatted sql

--changeset dth:041-school-ward-fk
--comment Địa bàn của trường thành khoá ngoại tới danh mục phường/xã.

-- `schools.ward` đang là chữ tự do, trong khi danh mục `wards` đã có đủ 168
-- phường/xã (seed 021). Hai thứ cùng nói về một sự thật mà không nối với nhau.
--
-- Chữ tự do làm hỏng đúng thứ hồ sơ đòi: mục 3.5.2 và 3.5.8 yêu cầu TỔNG HỢP
-- SỐ LIỆU THEO ĐỊA BÀN. "Phường Sài Gòn", "P. Sài Gòn" và "phường sài gòn" là
-- ba nhóm khác nhau khi GROUP BY, nên báo cáo theo địa bàn sẽ sai mà không có
-- dấu hiệu nào — con số vẫn ra, chỉ là ra nhầm.
--
-- Nó còn là khoá của phân quyền: UBND quản lý trường trên địa bàn mình, nên
-- "địa bàn" phải là một bản ghi có id để so sánh, không phải một chuỗi để
-- đoán.
ALTER TABLE schools
    ADD COLUMN ward_id BIGINT REFERENCES wards (id) ON DELETE RESTRICT;

-- Ghép theo tên, bỏ tiền tố và chuẩn hoá khoảng trắng lẫn hoa thường. Dữ liệu
-- seed không đặt `ward` nên thường không khớp dòng nào; câu này để cứu dữ liệu
-- ai đó đã nhập tay. Dòng không ghép được thì `ward_id` rỗng — không đoán bừa.
UPDATE schools s
SET ward_id = w.id
FROM wards w
WHERE s.ward IS NOT NULL
  AND lower(regexp_replace(regexp_replace(s.ward, '^\s*(Phường|Xã|P\.|X\.)\s*', '', 'i'), '\s+', ' ', 'g'))
    = lower(regexp_replace(w.name, '^\s*(Phường|Xã)\s*', '', 'i'));

-- Cột cũ giữ lại, đổi tên thành `ward_text`, KHÔNG xoá. Nếu có dòng không ghép
-- được thì giá trị người dùng nhập vẫn còn để đối chiếu; xoá đi là mất dữ liệu
-- không lấy lại được, chỉ để tiết kiệm một cột. Một migration sau, khi lưới
-- phủ đã sạch, mới nên bỏ nó.
ALTER TABLE schools RENAME COLUMN ward TO ward_text;

-- "Các trường trên địa bàn này" — câu hỏi của cả báo cáo lẫn phân quyền.
CREATE INDEX idx_schools_ward ON schools (ward_id);
