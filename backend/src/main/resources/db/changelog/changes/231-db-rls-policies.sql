--liquibase formatted sql

--changeset qltb:231-db-rls-functions splitStatements:false
-- Ba hàm đọc phạm vi do RowSecurityDataSource ghi vào phiên (docs/kien-truc/03 mục "Lớp CSDL").
-- Chưa ghi gì (job, Liquibase, khởi động) = không bị giới hạn: chỉ đúng chế độ 'school' mới lọc.
CREATE OR REPLACE FUNCTION public.rls_restricted() RETURNS boolean
    LANGUAGE sql STABLE
AS $$ SELECT coalesce(current_setting('app.rls_mode', true), '') = 'school' $$;

CREATE OR REPLACE FUNCTION public.rls_school_ids() RETURNS bigint[]
    LANGUAGE sql STABLE
AS $$ SELECT coalesce(nullif(current_setting('app.rls_school_ids', true), ''), '{}')::bigint[] $$;

-- Trường "đối tác" qua phiếu điều chuyển đã gửi (không tính nháp): trường nhận phải đọc tài sản, phòng, cán bộ,
-- phiếu nhập của trường chuyển để kiểm nhận; trường chuyển vẫn mở lại được phiếu cũ khi tài sản đã sang trường nhận.
CREATE OR REPLACE FUNCTION public.rls_linked_school_ids() RETURNS bigint[]
    LANGUAGE sql STABLE
AS $$
    SELECT coalesce(array_agg(DISTINCT x.s), '{}'::bigint[])
    FROM (SELECT t.target_school_id AS s FROM public.equipment_transfers t
          WHERE t.school_id = ANY (public.rls_school_ids()) AND t.status <> 'DRAFT'
          UNION ALL
          SELECT t.school_id FROM public.equipment_transfers t
          WHERE t.target_school_id = ANY (public.rls_school_ids()) AND t.status <> 'DRAFT') x
$$;

GRANT EXECUTE ON FUNCTION public.rls_restricted(), public.rls_school_ids(), public.rls_linked_school_ids() TO PUBLIC;

--changeset qltb:231-db-rls-policies splitStatements:false
-- Bật RLS + FORCE (ứng dụng là CHỦ bảng; không FORCE thì chủ bảng không bị chính sách nào chặn).
-- Các hàm được bọc (SELECT ...) để PostgreSQL tính một lần mỗi câu lệnh (InitPlan), không tính lại từng dòng.
--   own    = không bị giới hạn, hoặc school_id thuộc tập trường của người gọi
--   linked = own, hoặc school_id thuộc trường đối tác điều chuyển
-- Ba nhóm bảng:
--   1. chặt (đọc + ghi = own): phiếu và dữ liệu riêng của trường;
--   2. tham chiếu (đọc = linked, ghi = own): tài sản, phiếu nhập, phòng, khối nhà, cơ sở, cán bộ — thứ mà dòng của
--      trường KHÁC trỏ tới qua điều chuyển; tài sản được cả ghi = linked (trường nhận đổi trường / phòng / trạng thái
--      tài sản của trường chuyển khi kiểm nhận);
--   3. equipment_transfers: trường chuyển, hoặc trường nhận khi phiếu đã gửi.
DO $$
DECLARE
    own    CONSTANT text := 'NOT (SELECT public.rls_restricted()) OR school_id = ANY ((SELECT public.rls_school_ids())::bigint[])';
    linked CONSTANT text := 'NOT (SELECT public.rls_restricted()) OR school_id = ANY ((SELECT public.rls_school_ids())::bigint[])'
        || ' OR school_id = ANY ((SELECT public.rls_linked_school_ids())::bigint[])';
    target CONSTANT text := 'target_school_id = ANY ((SELECT public.rls_school_ids())::bigint[])';
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'consumption_records', 'damage_reports', 'depreciation_orders', 'disposals', 'equipment_allocations',
        'equipment_loans', 'equipment_stock', 'evidence_submissions', 'facility_works', 'inventory_sessions',
        'maintenance_orders', 'maintenance_plans', 'purchase_proposals', 'repair_orders', 'room_bookings',
        'school_classes', 'standard_adjustments', 'stock_issues', 'storage_orders', 'subject_teams',
        'warranty_claims']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY rls_school ON public.%I FOR ALL USING (%s) WITH CHECK (%s)', t, own, own);
    END LOOP;

    FOREACH t IN ARRAY ARRAY['equipment', 'equipment_intakes', 'rooms', 'buildings', 'campuses', 'staff']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY rls_school_read ON public.%I FOR SELECT USING (%s)', t, linked);
        EXECUTE format('CREATE POLICY rls_school_insert ON public.%I FOR INSERT WITH CHECK (%s)', t, own);
        IF t = 'equipment' THEN
            EXECUTE format('CREATE POLICY rls_school_update ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
                           t, linked, linked);
        ELSE
            EXECUTE format('CREATE POLICY rls_school_update ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
                           t, own, own);
        END IF;
        EXECUTE format('CREATE POLICY rls_school_delete ON public.%I FOR DELETE USING (%s)', t, own);
    END LOOP;

    ALTER TABLE public.equipment_transfers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.equipment_transfers FORCE ROW LEVEL SECURITY;
    EXECUTE format('CREATE POLICY rls_school_read ON public.equipment_transfers FOR SELECT USING (%s OR (%s AND status <> %L))',
                   own, target, 'DRAFT');
    EXECUTE format('CREATE POLICY rls_school_insert ON public.equipment_transfers FOR INSERT WITH CHECK (%s)', own);
    EXECUTE format('CREATE POLICY rls_school_update ON public.equipment_transfers FOR UPDATE USING (%s OR %s) WITH CHECK (%s OR %s)',
                   own, target, own, target);
    EXECUTE format('CREATE POLICY rls_school_delete ON public.equipment_transfers FOR DELETE USING (%s)', own);
END $$;
