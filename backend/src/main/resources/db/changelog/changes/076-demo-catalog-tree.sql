--liquibase formatted sql

--changeset qltb:076-demo-subject-teaching-codes
--comment DỮ LIỆU DEMO. Mã dạy học (thành phần MH của mã thiết bị) cho 15 môn mà 027 để NULL. Không có mã thì EquipmentCodeService trả rỗng và KHÔNG sinh được mã nào — tệ hơn hiện trạng, vì hiện mọi nhóm rơi vào SHARED_SUBJECT '00' nên ít ra còn chạy. Bốn mã 22..25 của 027 giữ nguyên (chúng đến từ một nguồn thật); 15 mã dưới đây do ta đặt để môi trường demo chạy được, PHẢI thay bằng bảng mã chính thức của Bộ trước khi dùng thật. 'Dùng chung' cố ý nhận '00', trùng với SHARED_SUBJECT: thiết bị không thuộc môn nào vẫn nằm đúng bộ đếm cũ, không dòng dữ liệu nào phải dịch chuyển.
UPDATE subjects s SET teaching_code = v.teaching_code, updated_at = now()
FROM (VALUES
    ('CHUNG', '00'), ('TOAN', '01'), ('VAT_LY', '02'), ('HOA_HOC', '03'),
    ('SINH_HOC', '04'), ('NGU_VAN', '05'), ('LICH_SU', '06'), ('DIA_LY', '07'),
    ('TIENG_ANH', '08'), ('TIN_HOC', '09'), ('GDCD', '10'), ('CONG_NGHE', '11'),
    ('AM_NHAC', '12'), ('MY_THUAT', '13'), ('THE_DUC', '14')
) AS v(code, teaching_code)
WHERE s.code = v.code AND s.teaching_code IS NULL;
--rollback UPDATE subjects SET teaching_code = NULL WHERE code IN ('CHUNG','TOAN','VAT_LY','HOA_HOC','SINH_HOC','NGU_VAN','LICH_SU','DIA_LY','TIENG_ANH','TIN_HOC','GDCD','CONG_NGHE','AM_NHAC','MY_THUAT','THE_DUC');

--changeset qltb:076-demo-catalog-subject
--comment DỮ LIỆU DEMO. Gắn MÔN cho từng mặt hàng. Đây là thứ quyết định thành phần MH của mã thiết bị: trước thay đổi này mọi thiết bị của một trường dùng CHUNG một bộ đếm 99 số một năm (equipment_code_sequences chỉ toàn prefix ...00...), một phiếu nhập 100 máy là checkCodeCapacity chặn cả phiếu. Tài sản đã cấp mã giữ nguyên mã cũ — mã đã in ra tem thì không sửa lùi; chỉ tài sản sinh từ đây về sau mới mang MH mới. KHÔNG dựng cây nhóm cha ở đây: phân loại là bảng equipment_types, và equipment_catalogs là bảng MẶT HÀNG — xem equipment-aside.tsx, cây cột trái dựng từ hai bảng nên một dòng phân loại nhét vào bảng mặt hàng sẽ hiện ra như một món hàng chọn được.
UPDATE equipment_catalogs c SET subject_id = s.id, updated_at = now()
FROM (VALUES
    ('NTB-MCH',      'CHUNG'),
    ('NTB-GHE',      'CHUNG'),
    ('TB-LOA',       'CHUNG'),
    ('TB-BANGTT',    'CHUNG'),
    ('TB-MAYIN',     'CHUNG'),
    ('TB-TIVI',      'CHUNG'),
    ('TB-MAYTINH',   'TIN_HOC'),
    ('TB-LAPTOP',    'TIN_HOC'),
    ('TB-BODIEN',    'VAT_LY'),
    ('TB-ONGNGHIEM', 'HOA_HOC'),
    ('TB-KINHHV',    'SINH_HOC'),
    ('TB-MOHINHCT',  'SINH_HOC'),
    ('TB-BANDOVN',   'DIA_LY')
) AS v(code, subject_code)
JOIN subjects s ON s.code = v.subject_code
WHERE c.code = v.code AND c.subject_id IS NULL;
--rollback UPDATE equipment_catalogs SET subject_id = NULL WHERE code IN ('NTB-MCH','NTB-GHE','TB-LOA','TB-BANGTT','TB-MAYIN','TB-TIVI','TB-MAYTINH','TB-LAPTOP','TB-BODIEN','TB-ONGNGHIEM','TB-KINHHV','TB-MOHINHCT','TB-BANDOVN');

--changeset qltb:076-demo-catalog-legal-basis
--comment DỮ LIỆU DEMO. Căn cứ pháp lý chỉ điền cho mặt hàng thuộc danh mục tối thiểu (minimum_required) — đó là những mặt hàng có một văn bản đứng sau; điền cho cả bảng thì cột này thành trang trí và không phân biệt được cái nào thật sự bị Thông tư ràng buộc. Chuỗi dưới đây ở mức THÔNG TƯ, chưa phải dòng phụ lục cụ thể của từng môn - từng cấp.
UPDATE equipment_catalogs
SET legal_basis = 'Danh mục thiết bị dạy học tối thiểu — TT 37, 38, 39/2021/TT-BGDĐT (sửa đổi bởi TT 26/2023/TT-BGDĐT)',
    updated_at = now()
WHERE minimum_required AND legal_basis IS NULL;
--rollback UPDATE equipment_catalogs SET legal_basis = NULL WHERE legal_basis LIKE 'Danh mục thiết bị dạy học tối thiểu%';

--changeset qltb:076-drop-duplicate-projector
--comment DỮ LIỆU DEMO. 'TB-MAYCHIEU' (Máy chiếu đa năng) trùng nghĩa với 'NTB-MCH' (Máy chiếu) — hai mặt hàng cho cùng một thứ làm màn Tổng hợp đếm tách đôi. Giữ 'NTB-MCH' vì nó đang có 9 tài sản và 3 dòng phiếu; 'TB-MAYCHIEU' không có tham chiếu nào. Bốn điều kiện NOT EXISTS là để môi trường nào đã lỡ dùng nó thì changeset này KHÔNG LÀM GÌ, thay vì xoá mất dữ liệu.
DELETE FROM equipment_catalogs c
WHERE c.code = 'TB-MAYCHIEU'
  AND NOT EXISTS (SELECT 1 FROM equipment e WHERE e.catalog_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM equipment_intake_lines l WHERE l.catalog_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM equipment_stock s WHERE s.catalog_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM equipment_catalogs x WHERE x.parent_id = c.id);
--rollback INSERT INTO equipment_catalogs (code, name, sort_order, active, tracking_type, minimum_required, used_by_teacher, used_by_student, self_made, asset_category, physical_or_digital, created_at) VALUES ('TB-MAYCHIEU', 'Máy chiếu đa năng', 10, TRUE, 'SERIAL', FALSE, FALSE, FALSE, FALSE, 'FIXED_ASSET', 'TB', now());
