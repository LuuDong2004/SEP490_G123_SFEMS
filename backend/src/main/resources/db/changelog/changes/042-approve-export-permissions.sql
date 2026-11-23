--liquibase formatted sql

--changeset dth:042-approve-export-permissions
--comment Mở rộng vốn từ quyền: thêm hành động approve và export theo Chương V mục 3.6.5.

-- Hồ sơ mục 3.6.5 đòi phân quyền chi tiết tới từng thao tác "xem, thêm, sửa,
-- xóa, PHÊ DUYỆT, XUẤT DỮ LIỆU". Vốn từ hiện tại chỉ có read/write/delete.
--
-- Vì sao `approve` phải là một hành động, không phải một giá trị của trường
-- `status`: nếu trạng thái là một ô chọn trên form thì mọi bước nhảy đều hợp lệ
-- như nhau, và luật "chỉ nháp mới trình duyệt được" phải đi kiểm ở một chỗ
-- khác. Mỗi chuyển trạng thái là một endpoint riêng, và endpoint thì cần mã
-- quyền riêng.
--
-- Vì sao `export` phải tách khỏi `read`: xem một danh sách trên màn hình và
-- mang cả danh sách đó ra khỏi hệ thống dưới dạng tệp là hai việc có rủi ro
-- khác nhau. Mục 3.9.6 bắt ghi nhật ký riêng cho thao tác xuất dữ liệu — tức
-- là hồ sơ cũng coi chúng là hai chuyện.

-- ---------------------------------------------------------------- export
-- Sinh từ chính các mã `:read` đang có, nên không có danh sách nào để quên cập
-- nhật khi thêm tài nguyên mới. Tên tiếng Việt suy ra từ tên của mã `:read`.
--
-- Trừ hai tài nguyên:
--   · notifications — hộp thư của chính mình, không có gì để "xuất" cho ai
--   · permissions   — danh mục nội bộ do migration viết, không phải dữ liệu nghiệp vụ
INSERT INTO permissions (code, name, description, system_permission)
SELECT replace(p.code, ':read', ':export'),
       CASE WHEN p.name LIKE 'Xem %' THEN 'Xuất ' || substring(p.name FROM 5)
            ELSE 'Xuất dữ liệu — ' || p.name END,
       'Xuất dữ liệu ra tệp (PDF, Excel hoặc CSV)',
       TRUE
FROM permissions p
WHERE p.code LIKE '%:read'
  AND p.code NOT IN ('notifications:read', 'permissions:read')
  AND NOT EXISTS (SELECT 1 FROM permissions x WHERE x.code = replace(p.code, ':read', ':export'));

-- ---------------------------------------------------------------- approve
-- Chỉ phiếu nhập, vì đó là chứng từ duy nhất có vòng đời ở thời điểm này. Sáu
-- loại phiếu còn lại (cấp phát, điều chuyển, mượn trả, sửa chữa, kiểm kê,
-- thanh lý) sẽ thêm mã của mình trong migration dựng bảng của chúng — một mã
-- quyền không gác endpoint nào là một mã quyền nói dối.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('equipment_intakes:approve',
   'Duyệt phiếu nhập',
   'Trình duyệt, phê duyệt, từ chối và xác nhận nhận hàng',
   TRUE);

-- ---------------------------------------------------------------- cấp cho ADMIN
-- Phải nêu tên ADMIN tường minh. Migration 005 cấp cho ADMIN "mọi quyền đang
-- tồn tại LÚC ĐÓ" — một phép nối trên những dòng chưa ra đời. Mã thêm sau 005
-- không thuộc về ai cho tới khi có câu lệnh nói ra.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code LIKE '%:export' OR p.code = 'equipment_intakes:approve'
WHERE r.code = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id);
