--liquibase formatted sql

-- Lãnh đạo trường KHÔNG thấy phiếu nháp CHƯA TỪNG TRÌNH.
--
-- Phiếu nháp là việc cấp dưới đang làm dở, chưa trình: số liệu chưa hoàn chỉnh, và người duyệt chỉ nên
-- thấy phiếu từ lúc nó được trình. Trước changelog này phạm vi đọc của SCHOOL_LEADER trên mọi loại phiếu
-- chỉ là "phiếu của trường mình", không có điều kiện về trạng thái, nên phiếu nháp hiện đủ trong danh
-- sách và mở được chi tiết.
--
-- Sửa bằng PHẠM VI DÒNG chứ không bằng một bộ lọc ở màn hình: ẩn ở giao diện thì gõ tay đường dẫn hay
-- gọi thẳng API vẫn đọc được. Phạm vi đọc mới là
--
--     ALL[ phạm vi cũ, ANY[ status <> DRAFT, returnNote IS NOT NULL ] ]
--
-- — bọc quanh phạm vi đang có thay vì viết lại, nên điều kiện hai vế của phiếu điều chuyển (trường
-- chuyển HOẶC trường nhận) giữ nguyên.
--
-- Vế `returnNote IS NOT NULL` là phiếu BỊ TRẢ LẠI. Trả lại đưa phiếu về DRAFT để người lập sửa được
-- (nhãn "Bị trả về" chỉ là cách hiển thị), nhưng nó không còn là việc chưa ai thấy: lãnh đạo đã đọc
-- toàn bộ lúc duyệt, và ẩn đi thì người vừa trả mất dấu phiếu, không xem lại được lý do mình ghi, không
-- biết còn một phiếu đang treo. Lời nhắn là bắt buộc khi trả lại (`VoucherWorkflow.returnToDraft`) và
-- không bao giờ bị xoá, nên "có lời nhắn" đúng bằng "đã từng được trình". Vì thế hai trường `status` và
-- `returnNote` nằm trong tập trường của mọi chính sách phiếu (`VoucherPolicies`, `EquipmentIntakePolicies`).
--
-- Giá trị so sánh phải viết {"lit": …}: một chuỗi trần bị trình biên dịch chính sách từ chối và cả 16
-- dòng bị cách ly — với DefaultScope.NONE nghĩa là lãnh đạo trường không thấy phiếu nào.
--
-- Chỉ phạm vi `read`. Lãnh đạo trường không có mã quyền `write` trên loại phiếu nào nên không tự lập
-- phiếu — không có trường hợp "phiếu nháp của chính mình" bị ẩn nhầm. Phiếu nháp do sự kiện sinh ra
-- trong lúc lãnh đạo duyệt (phiếu sửa chữa từ báo hỏng…) được ghi thẳng, không đọc lại qua phạm vi này.
-- Sở và UBND không đổi: phạm vi của các vai đó nằm ngoài changelog này.
--
-- Chạy lại không đổi gì: dòng đã có điều kiện trên `status` bị bỏ qua.

--changeset qltb:117-school-leader-no-draft-vouchers
UPDATE row_level_policy p
SET scope = jsonb_build_object('all', jsonb_build_array(
                p.scope,
                '{"any": [{"op": "ne", "field": "status", "value": {"lit": "DRAFT"}},
                          {"op": "isNotNull", "field": "returnNote"}]}'::jsonb)),
    name = 'Phiếu đã trình của trường mình',
    description = 'Chỉ phiếu của trường mà tài khoản được gán, không gồm phiếu nháp chưa từng trình. Phiếu bị trả lại vẫn thấy.',
    updated_at = now()
FROM roles r
WHERE r.id = p.role_id AND r.code = 'SCHOOL_LEADER'
  AND p.kind = 'SCOPE' AND p.action = 'read'
  AND p.resource IN (
      'equipment_intakes', 'equipment_allocations', 'equipment_transfers', 'equipment_loans',
      'damage_reports', 'repair_orders', 'warranty_claims', 'maintenance_orders',
      'inventory_sessions', 'disposals', 'depreciation_orders', 'consumption_records',
      'stock_issues', 'storage_orders', 'room_bookings', 'purchase_proposals')
  AND p.scope::text NOT LIKE '%"status"%';
--rollback UPDATE row_level_policy p SET scope = p.scope -> 'all' -> 0, name = 'Chỉ trường của mình', description = 'Chỉ dữ liệu của trường mà tài khoản được gán.' FROM roles r WHERE r.id = p.role_id AND r.code = 'SCHOOL_LEADER' AND p.kind = 'SCOPE' AND p.action = 'read' AND p.scope::text LIKE '%"field": "status"%' AND jsonb_typeof(p.scope -> 'all') = 'array';

-- Cùng luật cho CƠ QUAN QUẢN LÝ và GIÁO VIÊN.
--
-- Để riêng lãnh đạo trường thì thứ bậc lộn ngược: cấp trên trực tiếp, ngồi cùng trường, không xem được
-- phiếu đang làm dở, còn Sở và UBND ở xa hơn lại xem được. Tờ nháp là việc nội bộ của người lập; cơ
-- quan cấp trên nhận hồ sơ từ lúc trường trình. Bốn vai Sở / UBND không có mã `write` trên loại phiếu
-- nào nên không có phiếu nháp của chính mình để ẩn nhầm. ADMIN giữ nguyên toàn quyền.
--
-- Luật nhận biết "đã từng trình", không phải "đã tới cấp mình": phiếu bị lãnh đạo trường trả lại, chưa
-- lên UBND, thì UBND vẫn thấy. Chặt hơn hẳn hiện trạng (thấy tất cả); "chỉ thấy phiếu đã tới cấp mình"
-- là một luật khác, cần thêm thông tin về cấp duyệt trên phiếu.
--
-- Giáo viên đọc được hai loại phiếu. Phiếu ghi tăng: như trên. Phiếu ĐẶT PHÒNG thì giáo viên tự lập
-- (`room_bookings:write`), nên thêm vế `createdById = user.id` — phiếu nháp của chính mình vẫn thấy,
-- của người khác thì không.

--changeset qltb:117-management-teacher-no-draft-vouchers
UPDATE row_level_policy p
SET scope = jsonb_build_object('all', jsonb_build_array(
                p.scope,
                '{"any": [{"op": "ne", "field": "status", "value": {"lit": "DRAFT"}},
                          {"op": "isNotNull", "field": "returnNote"}]}'::jsonb)),
    description = COALESCE(p.description, '') || ' Không gồm phiếu nháp chưa từng trình; phiếu bị trả lại vẫn thấy.',
    updated_at = now()
FROM roles r
WHERE r.id = p.role_id
  AND p.kind = 'SCOPE' AND p.action = 'read'
  AND p.scope::text NOT LIKE '%"status"%'
  AND ((r.code IN ('SO_LEADER', 'SO_SPECIALIST', 'UBND_LEADER', 'UBND_SPECIALIST')
        AND p.resource IN (
            'equipment_intakes', 'equipment_allocations', 'equipment_transfers', 'equipment_loans',
            'damage_reports', 'repair_orders', 'warranty_claims', 'maintenance_orders',
            'inventory_sessions', 'disposals', 'depreciation_orders', 'consumption_records',
            'stock_issues', 'storage_orders', 'room_bookings', 'purchase_proposals'))
       OR (r.code = 'TEACHER' AND p.resource = 'equipment_intakes'));

UPDATE row_level_policy p
SET scope = jsonb_build_object('all', jsonb_build_array(
                p.scope,
                '{"any": [{"op": "ne", "field": "status", "value": {"lit": "DRAFT"}},
                          {"op": "isNotNull", "field": "returnNote"},
                          {"op": "eq", "field": "createdById", "value": {"ctx": "user.id"}}]}'::jsonb)),
    description = COALESCE(p.description, '') || ' Không gồm phiếu nháp chưa trình của người khác; phiếu nháp của chính mình vẫn thấy.',
    updated_at = now()
FROM roles r
WHERE r.id = p.role_id AND r.code = 'TEACHER'
  AND p.kind = 'SCOPE' AND p.action = 'read' AND p.resource = 'room_bookings'
  AND p.scope::text NOT LIKE '%"status"%';
--rollback UPDATE row_level_policy p SET scope = p.scope -> 'all' -> 0 FROM roles r WHERE r.id = p.role_id AND r.code IN ('SO_LEADER','SO_SPECIALIST','UBND_LEADER','UBND_SPECIALIST','TEACHER') AND p.kind = 'SCOPE' AND p.action = 'read' AND p.scope::text LIKE '%"field": "status"%' AND jsonb_typeof(p.scope -> 'all') = 'array';
