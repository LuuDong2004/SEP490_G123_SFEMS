--liquibase formatted sql

--changeset qltb:070-catalog-asset-category
-- Loại tài sản và vật lý/số chuyển lên NHÓM THIẾT BỊ.
--
-- Trước đây hai thứ này chỉ khai trên từng tài sản, nên người lập hồ sơ phải tự
-- nhớ "ống nghiệm là vật tư" cho từng cái một — và hai cái cùng nhóm rất dễ ra
-- hai cách hạch toán khác nhau mà không ai đối chiếu được. Chúng là tính chất
-- của MẶT HÀNG, nên chỗ đúng của chúng là danh mục.
--
-- Cột vẫn cho NULL: nhóm chưa khai thì form thiết bị không điền hộ, người nhập
-- chọn tay như cũ. Không đặt mặc định để "chưa ai khai" phân biệt được với
-- "đã khai và đúng là TSCĐ".
ALTER TABLE equipment_catalogs ADD COLUMN asset_category VARCHAR(30);
ALTER TABLE equipment_catalogs ADD COLUMN physical_or_digital VARCHAR(30);

-- Khai cho 14 nhóm mẫu đang có. Ghép theo MÃ chứ không theo id, như mọi seed khác.
-- Máy móc, thiết bị nghe nhìn, máy tính: tài sản cố định.
UPDATE equipment_catalogs SET asset_category = 'FIXED_ASSET'
WHERE code IN ('NTB-MCH', 'TB-MAYCHIEU', 'TB-KINHHV', 'TB-LAPTOP', 'TB-MAYTINH',
               'TB-MAYIN', 'TB-TIVI', 'TB-LOA', 'TB-BANGTT');

-- Dùng nhiều năm nhưng không đủ ngưỡng TSCĐ: công cụ, dụng cụ lâu bền.
UPDATE equipment_catalogs SET asset_category = 'DURABLE_TOOL'
WHERE code IN ('NTB-GHE', 'TB-BANDOVN', 'TB-MOHINHCT', 'TB-BODIEN');

-- Hao hụt trong sử dụng, quản lý theo lô: vật tư.
UPDATE equipment_catalogs SET asset_category = 'SUPPLY'
WHERE code IN ('TB-ONGNGHIEM');

-- Cả 14 nhóm mẫu đều là hiện vật; chưa có nhóm phần mềm nào.
UPDATE equipment_catalogs SET physical_or_digital = 'PHYSICAL'
WHERE physical_or_digital IS NULL;
