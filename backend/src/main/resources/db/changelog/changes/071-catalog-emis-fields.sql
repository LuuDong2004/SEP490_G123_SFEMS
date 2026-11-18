--liquibase formatted sql

--changeset qltb:071-catalog-emis-fields
-- Những gì hồ sơ một MẶT HÀNG thiết bị dạy học còn thiếu, đối chiếu với danh mục
-- thiết bị giáo dục của EMIS.
--
-- Mã thống kê là mã trong danh mục do cấp chủ quản ban hành; `code` vẫn là mã
-- trường tự đặt. Hai mã phải tách nhau, nếu không trường đổi mã nội bộ một cái
-- là số liệu gửi lên không ghép được với danh mục gốc nữa.
ALTER TABLE equipment_catalogs ADD COLUMN statistical_code VARCHAR(64);

-- Căn cứ pháp lý của định mức: "Thông tư 38/2011/TT-BGDĐT", "QĐ 1436/QĐ-TTg"…
-- Người duyệt mua sắm hỏi câu này trước mọi câu khác.
ALTER TABLE equipment_catalogs ADD COLUMN legal_basis VARCHAR(255);

-- Đối tượng sử dụng. Hai cờ chứ không một enum, vì rất nhiều thiết bị dùng cho
-- CẢ giáo viên và học sinh — một enum sẽ phải sinh ra giá trị "cả hai" và mọi
-- câu lọc đều phải nhớ cộng nó vào.
ALTER TABLE equipment_catalogs ADD COLUMN used_by_teacher BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE equipment_catalogs ADD COLUMN used_by_student BOOLEAN NOT NULL DEFAULT FALSE;

-- Thiết bị tự làm: giáo viên tự chế tạo, có báo cáo riêng và không nằm trong
-- danh mục mua sắm. Không suy ra được từ trường nào khác.
ALTER TABLE equipment_catalogs ADD COLUMN self_made BOOLEAN NOT NULL DEFAULT FALSE;

-- KHÔNG thêm cờ "thiết bị tiêu hao": asset_category ở changelog 070 đã nói điều
-- đó bằng SUPPLY và CHEMICAL. Thêm một cờ nữa là mở đường cho một nhóm vừa là
-- "vật tư" vừa "không tiêu hao", và không ai biết bên nào đúng.

-- Khai cho 14 nhóm mẫu: mã thống kê tạm lấy chính mã nhóm (dữ liệu demo chưa
-- ghép với danh mục quốc gia), và đánh dấu đối tượng sử dụng theo lẽ thường.
UPDATE equipment_catalogs SET statistical_code = code WHERE statistical_code IS NULL;

-- Thiết bị trình chiếu, nghe nhìn, máy móc: giáo viên dùng.
UPDATE equipment_catalogs SET used_by_teacher = TRUE
WHERE code IN ('NTB-MCH', 'TB-MAYCHIEU', 'TB-LAPTOP', 'TB-MAYIN', 'TB-TIVI', 'TB-LOA', 'TB-BANGTT');

-- Dụng cụ thí nghiệm, mô hình, bàn ghế: học sinh trực tiếp dùng.
UPDATE equipment_catalogs SET used_by_student = TRUE
WHERE code IN ('NTB-GHE', 'TB-ONGNGHIEM', 'TB-BODIEN', 'TB-MOHINHCT', 'TB-MAYTINH');

-- Kính hiển vi, bản đồ: cả thầy lẫn trò.
UPDATE equipment_catalogs SET used_by_teacher = TRUE, used_by_student = TRUE
WHERE code IN ('TB-KINHHV', 'TB-BANDOVN');
