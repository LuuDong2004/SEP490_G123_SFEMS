--liquibase formatted sql

--changeset dth:049-school-district
--comment Quận/huyện cũ trước 01/07/2025, giữ làm manh mối địa bàn khi chưa ghép được phường mới.

-- Danh mục `wards` là 168 phường/xã theo địa giới sau sáp nhập 01/07/2025.
-- Nhưng nguồn dữ liệu trường của Sở phần lớn vẫn ghi địa chỉ theo quận/huyện
-- CŨ: "Quận 1", "Quận Bình Tân", "Huyện Cần Giờ". Chỉ 75 trong 946 trường có
-- tên phường khớp được danh mục mới.
--
-- Bỏ thông tin quận cũ đi thì 871 trường còn lại KHÔNG có bất kỳ manh mối địa
-- bàn nào — không lọc được, không tổng hợp được, và người đi đối soát cũng
-- không biết bắt đầu từ đâu. Giữ lại thì báo cáo theo địa bàn vẫn làm được ở
-- mức quận cũ trong lúc chờ bảng map sang phường mới.
--
-- Đây là cột CHUYỂN TIẾP, không phải cột lâu dài: khi mọi trường đã có
-- `ward_id` thì nó hết việc. Không đặt khoá ngoại, vì các quận/huyện ấy không
-- còn là đơn vị hành chính nào để trỏ tới — chúng là dữ liệu lịch sử.
ALTER TABLE schools ADD COLUMN district VARCHAR(128);

-- "Các trường ở quận này" là câu hỏi duy nhất mà cột này tồn tại để trả lời.
CREATE INDEX idx_schools_district ON schools (district);
