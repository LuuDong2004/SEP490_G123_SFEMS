--liquibase formatted sql

-- Sở / UBND chỉ thấy phiếu đã trình TỚI BÀN MÌNH (QLTB-496).
--
-- Trước đây phạm vi đọc phiếu của bốn vai cơ quan quản lý chỉ có luật của 117: "không thấy phiếu nháp chưa
-- từng trình". Nên phiếu cán bộ trường vừa trình, còn đang chờ HIỆU TRƯỞNG duyệt, đã hiện ngay trên màn của
-- UBND / Sở. Đúng ra: cán bộ trình → chỉ hiệu trưởng thấy; hiệu trưởng duyệt, phiếu lên cơ quan quản lý →
-- lúc đó cơ quan mới thấy. 117 đã ghi rõ luật "chỉ thấy phiếu đã tới cấp mình" cần thêm thông tin về cấp
-- duyệt trên phiếu — changelog này thêm thông tin đó.
--
-- Cột mới `reached_step`: cấp CAO NHẤT phiếu từng đứng chờ duyệt, chỉ tăng (`SchoolVoucher.setApprovalStep`).
-- `approval_step` không dùng được: trả lại, từ chối, duyệt xong đều xoá nó, nên không còn biết phiếu từng lên
-- tới cơ quan quản lý hay chưa.
--
-- Phạm vi đọc mới của Sở / UBND, thay cho vế 117 (phạm vi trường giữ nguyên):
--
--     ANY[ reachedStep IN (MANAGING_BODY, RECEIVING_BODY),   -- phiếu đã từng lên tới cơ quan
--          status IN (APPROVED, COMPLETED) ]                 -- phiếu chỉ cần trường duyệt, đã duyệt xong
--
-- Hệ quả, đều có chủ ý:
--   * Phiếu đang chờ hiệu trưởng, phiếu hiệu trưởng trả lại / từ chối: cơ quan không thấy.
--   * Phiếu cơ quan đã TRẢ LẠI: vẫn thấy (đã lên tới bàn mình) — người trả theo dõi được lý do mình ghi.
--     Trường trình lại thì phiếu đứng chờ hiệu trưởng lần nữa mà cơ quan vẫn thấy: nó đã từng lên tới đó.
--   * Phiếu chỉ cần trường duyệt (cấp phát, báo hỏng, mượn…): cơ quan thấy sau khi trường duyệt xong.
--   * Sở đọc toàn ngành (phạm vi `{"all": []}`), nên phiếu của trường do UBND quản lý hiện với Sở từ lúc lên
--     tới UBND — đó là quyền giám sát của Sở, không phải phiếu chờ Sở duyệt.

--changeset qltb:125-voucher-reached-step splitStatements:false
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'equipment_intakes', 'equipment_allocations', 'equipment_transfers', 'equipment_loans',
        'damage_reports', 'repair_orders', 'warranty_claims', 'maintenance_orders',
        'inventory_sessions', 'disposals', 'depreciation_orders', 'consumption_records',
        'stock_issues', 'storage_orders', 'room_bookings', 'purchase_proposals']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS reached_step VARCHAR(20)', t);
        -- Phiếu cũ: cấp cao nhất giữa cấp đang chờ và mọi cấp ghi trong nhật ký duyệt của nó. Tên bảng
        -- trùng tên tài nguyên ghi trong voucher_events.resource. Thứ tự cấp như enum ApprovalStep.
        EXECUTE format($sql$
            UPDATE %1$I v
            SET reached_step = (ARRAY['SCHOOL', 'MANAGING_BODY', 'RECEIVING_BODY'])[s.rank]
            FROM (
                SELECT x.id,
                       GREATEST(
                           array_position(ARRAY['SCHOOL', 'MANAGING_BODY', 'RECEIVING_BODY']::varchar[], x.approval_step),
                           (SELECT MAX(array_position(ARRAY['SCHOOL', 'MANAGING_BODY', 'RECEIVING_BODY']::varchar[], e.step))
                            FROM voucher_events e
                            WHERE e.resource = %2$L AND e.voucher_id = x.id)) AS rank
                FROM %1$I x
            ) s
            WHERE s.id = v.id AND s.rank IS NOT NULL
        $sql$, t, t);
    END LOOP;
END $$;
--rollback DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['equipment_intakes','equipment_allocations','equipment_transfers','equipment_loans','damage_reports','repair_orders','warranty_claims','maintenance_orders','inventory_sessions','disposals','depreciation_orders','consumption_records','stock_issues','storage_orders','room_bookings','purchase_proposals'] LOOP EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS reached_step', t); END LOOP; END $$;

-- Phiếu điều chuyển của UBND: hai cơ quan, hai thời điểm. Phạm vi cũ là
--     ALL[ ANY[school.id ∈ quản lý, targetSchool.id ∈ quản lý], <vế 117> ]
-- Cơ quan của trường CHUYỂN thấy từ khi phiếu lên tới mình; cơ quan của trường NHẬN chỉ thấy khi phiếu tới
-- bước của chính họ (RECEIVING_BODY). Hai trường cùng một UBND thì không có bước trường nhận — vế đầu đã
-- phủ. Phiếu đã duyệt xong / hoàn tất: cả hai cơ quan đều thấy (trường nhận còn phải xác nhận đã nhận).
-- Chạy TRƯỚC vế chung bên dưới, vì vế chung cũng khớp hình dạng của dòng này.

--changeset qltb:125-ubnd-reads-transfers-at-its-step
UPDATE row_level_policy p
SET scope = jsonb_build_object('any', jsonb_build_array(
                jsonb_build_object('all', jsonb_build_array(
                    '{"op": "in", "field": "school.id", "value": {"ctx": "user.managedSchoolIds"}}'::jsonb,
                    '{"op": "in", "field": "reachedStep", "value": {"lit": ["MANAGING_BODY", "RECEIVING_BODY"]}}'::jsonb)),
                jsonb_build_object('all', jsonb_build_array(
                    '{"op": "in", "field": "targetSchool.id", "value": {"ctx": "user.managedSchoolIds"}}'::jsonb,
                    '{"op": "eq", "field": "reachedStep", "value": {"lit": "RECEIVING_BODY"}}'::jsonb)),
                jsonb_build_object('all', jsonb_build_array(
                    p.scope -> 'all' -> 0,
                    '{"op": "in", "field": "status", "value": {"lit": ["APPROVED", "COMPLETED"]}}'::jsonb)))),
    description = 'Phiếu điều chuyển có trường chuyển hoặc trường nhận thuộc cơ quan mình: trường chuyển — từ khi '
                  || 'phiếu lên tới cơ quan mình; trường nhận — khi tới bước của cơ quan trường nhận; '
                  || 'và mọi phiếu đã duyệt xong.',
    updated_at = now()
FROM roles r
WHERE r.id = p.role_id AND r.code IN ('UBND_LEADER', 'UBND_SPECIALIST')
  AND p.kind = 'SCOPE' AND p.action = 'read' AND p.resource = 'equipment_transfers'
  AND p.scope -> 'all' -> 1 = '{"any": [{"op": "ne", "field": "status", "value": {"lit": "DRAFT"}},
                                        {"op": "isNotNull", "field": "returnNote"}]}'::jsonb;
--rollback UPDATE row_level_policy p SET scope = jsonb_build_object('all', jsonb_build_array(p.scope -> 'any' -> 2 -> 'all' -> 0, '{"any": [{"op": "ne", "field": "status", "value": {"lit": "DRAFT"}}, {"op": "isNotNull", "field": "returnNote"}]}'::jsonb)) FROM roles r WHERE r.id = p.role_id AND r.code IN ('UBND_LEADER', 'UBND_SPECIALIST') AND p.kind = 'SCOPE' AND p.action = 'read' AND p.resource = 'equipment_transfers' AND p.scope ? 'any';

-- Vế chung cho mọi loại phiếu còn lại của bốn vai: thay vế 117 bằng vế "đã lên tới cơ quan / đã duyệt
-- xong", giữ nguyên vế phạm vi trường đứng đầu. Chỉ chạm dòng còn đúng hình dạng 117, nên chạy lại không
-- đổi gì và không đè dòng ai đó đã sửa tay.

--changeset qltb:125-management-reads-reached-vouchers
UPDATE row_level_policy p
SET scope = jsonb_build_object('all', jsonb_build_array(
                p.scope -> 'all' -> 0,
                '{"any": [{"op": "in", "field": "reachedStep", "value": {"lit": ["MANAGING_BODY", "RECEIVING_BODY"]}},
                          {"op": "in", "field": "status", "value": {"lit": ["APPROVED", "COMPLETED"]}}]}'::jsonb)),
    description = replace(COALESCE(p.description, ''),
                          'Không gồm phiếu nháp chưa từng trình; phiếu bị trả lại vẫn thấy.',
                          'Chỉ phiếu đã trình tới cơ quan quản lý, hoặc đã duyệt xong.'),
    updated_at = now()
FROM roles r
WHERE r.id = p.role_id AND r.code IN ('SO_LEADER', 'SO_SPECIALIST', 'UBND_LEADER', 'UBND_SPECIALIST')
  AND p.kind = 'SCOPE' AND p.action = 'read'
  AND p.resource IN (
      'equipment_intakes', 'equipment_allocations', 'equipment_transfers', 'equipment_loans',
      'damage_reports', 'repair_orders', 'warranty_claims', 'maintenance_orders',
      'inventory_sessions', 'disposals', 'depreciation_orders', 'consumption_records',
      'stock_issues', 'storage_orders', 'room_bookings', 'purchase_proposals')
  AND jsonb_typeof(p.scope -> 'all') = 'array'
  AND p.scope -> 'all' -> 1 = '{"any": [{"op": "ne", "field": "status", "value": {"lit": "DRAFT"}},
                                        {"op": "isNotNull", "field": "returnNote"}]}'::jsonb;
--rollback UPDATE row_level_policy p SET scope = jsonb_build_object('all', jsonb_build_array(p.scope -> 'all' -> 0, '{"any": [{"op": "ne", "field": "status", "value": {"lit": "DRAFT"}}, {"op": "isNotNull", "field": "returnNote"}]}'::jsonb)), description = replace(COALESCE(p.description, ''), 'Chỉ phiếu đã trình tới cơ quan quản lý, hoặc đã duyệt xong.', 'Không gồm phiếu nháp chưa từng trình; phiếu bị trả lại vẫn thấy.') FROM roles r WHERE r.id = p.role_id AND r.code IN ('SO_LEADER', 'SO_SPECIALIST', 'UBND_LEADER', 'UBND_SPECIALIST') AND p.kind = 'SCOPE' AND p.action = 'read' AND p.scope::text LIKE '%reachedStep%' AND jsonb_typeof(p.scope -> 'all') = 'array';
