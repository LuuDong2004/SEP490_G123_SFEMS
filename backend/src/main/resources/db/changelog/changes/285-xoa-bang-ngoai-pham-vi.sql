--liquibase formatted sql

--changeset luudong:285-xoa-bang-ngoai-pham-vi-rls splitStatements:false
--comment Không còn phiếu điều chuyển: trường "đối tác" luôn rỗng, chính sách đọc "linked" của equipment, equipment_intakes, rooms, buildings, campuses, staff bằng "own". Sửa hàm TRƯỚC khi xoá equipment_transfers (hàm viết bằng SQL, PostgreSQL không ghi phụ thuộc nên xoá bảng không báo lỗi, chỉ lỗi lúc đọc).
CREATE OR REPLACE FUNCTION public.rls_linked_school_ids() RETURNS bigint[]
    LANGUAGE sql STABLE
AS $$ SELECT '{}'::bigint[] $$;
--rollback CREATE OR REPLACE FUNCTION public.rls_linked_school_ids() RETURNS bigint[] LANGUAGE sql STABLE AS $$ SELECT coalesce(array_agg(DISTINCT x.s), '{}'::bigint[]) FROM (SELECT t.target_school_id AS s FROM public.equipment_transfers t WHERE t.school_id = ANY (public.rls_school_ids()) AND t.status <> 'DRAFT' UNION ALL SELECT t.school_id FROM public.equipment_transfers t WHERE t.target_school_id = ANY (public.rls_school_ids()) AND t.status <> 'DRAFT') x $$;

--changeset luudong:285-xoa-bang-ngoai-pham-vi
--comment Xoá bảng của các chức năng ngoài phạm vi 46 UC (quyền và phạm vi dòng đã gỡ ở 253): cấp phát, điều chuyển, mượn trả, báo hỏng, sửa chữa, bảo hành, bảo dưỡng, kế hoạch bảo trì, thanh lý, hao mòn, xuất kho, lưu kho, tiêu hao, mượn phòng, tồn kho theo lô, công trình CSVC, điều chỉnh chuẩn kiểu cũ (nay là school_norm_adjustments, 279), minh chứng, kết nối hệ thống ngoài, khoá API, học kỳ. Không bảng giữ lại nào có khoá ngoại tới các bảng này nên không dùng CASCADE (còn sót thì changeset dừng thay vì xoá lan). Chính sách RLS, chỉ mục, sequence của bảng tự mất theo bảng. Một câu DROP cho cả nhóm nên khoá ngoại giữa các bảng bị xoá không cản.
DELETE FROM row_level_policy WHERE resource = 'semesters';
DELETE FROM permissions WHERE split_part(code, ':', 1) = 'semesters';
DELETE FROM code_rules WHERE target = 'semesters';
-- Quy tắc mã của trường cho hai loại đã bỏ (SchoolCodeService.TARGETS chỉ còn phòng, khối nhà, cơ sở, cán bộ, tổ).
DELETE FROM school_code_rules WHERE target IN ('facility_works', 'maintenance_plans');
DROP TABLE IF EXISTS
    equipment_allocation_lines, equipment_allocations,
    equipment_transfer_lines, equipment_transfers,
    equipment_loan_lines, equipment_loans,
    damage_report_lines, damage_reports,
    repair_order_lines, repair_orders,
    warranty_claim_lines, warranty_claims,
    maintenance_order_lines, maintenance_orders,
    maintenance_plan_equipment, maintenance_plans,
    disposal_lines, disposals,
    depreciation_order_lines, depreciation_orders,
    stock_issue_lines, stock_issues,
    storage_order_lines, storage_orders,
    consumption_records,
    room_booking_lines, room_bookings,
    equipment_stock,
    facility_works,
    standard_adjustment_lines, standard_adjustments,
    standard_adjustment_rule_substitutes, standard_adjustment_rules,
    evidence_submissions, evidence_criteria,
    integration_transactions, integration_systems,
    api_clients,
    semesters;
--rollback --không khôi phục được: bảng và dữ liệu đã xoá (xem changelog gốc của từng bảng)
