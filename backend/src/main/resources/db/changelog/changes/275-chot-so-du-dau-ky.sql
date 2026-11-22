--liquibase formatted sql

--changeset luudong:275-chot-so-du-dau-ky splitStatements:false
--comment Chốt số dư đầu kỳ của trường. Trước khi chốt, cán bộ thiết bị khai tay hoặc nhập từ tệp các thiết bị trường đang có (TS-01, TS-07). Hiệu trưởng chốt xong thì thiết bị mới chỉ vào sổ qua phiếu ghi tăng có duyệt (PN-01..03). Một dòng cho mỗi trường đã chốt; chưa có dòng là chưa chốt.
CREATE TABLE school_opening_balances (
    school_id     BIGINT      PRIMARY KEY REFERENCES schools (id) ON DELETE CASCADE,
    closed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_by_id  BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    equipment_count INTEGER   NOT NULL DEFAULT 0
);

-- Phạm vi dòng như các bảng của trường (231): người của trường chỉ thấy, chỉ ghi dòng của trường mình.
DO $$
DECLARE
    own CONSTANT text := 'NOT (SELECT public.rls_restricted()) OR school_id = ANY ((SELECT public.rls_school_ids())::bigint[])';
BEGIN
    ALTER TABLE public.school_opening_balances ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.school_opening_balances FORCE ROW LEVEL SECURITY;
    EXECUTE format('CREATE POLICY rls_school ON public.school_opening_balances FOR ALL USING (%s) WITH CHECK (%s)', own, own);
END $$;
--rollback DROP TABLE school_opening_balances;
