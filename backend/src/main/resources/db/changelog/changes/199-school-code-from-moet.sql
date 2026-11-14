--liquibase formatted sql

-- MÃ TRƯỜNG = MÃ SỞ. Người dùng tra trường bằng mã Sở cấp; mã nội bộ cũ (TR0185, THXUANHIEP…) không ai nhận ra.
-- Trường có mã Sở thì lấy mã Sở làm mã trường; trường chưa có mã Sở giữ mã cũ. Mã tài sản dùng mã hai ký tự
-- (short_code), không dùng mã trường, nên mã tài sản đã in không đổi. Mã Sở là duy nhất; trường nào mà mã Sở đang là mã
-- của một trường khác thì bỏ qua (không vỡ ràng buộc duy nhất), báo trong log.

--changeset qltb:199-school-code-from-moet splitStatements:false
DO $$
DECLARE
    n INT;
    skipped INT;
BEGIN
    SELECT count(*) INTO skipped FROM schools a
    WHERE a.moet_code IS NOT NULL AND a.code <> a.moet_code
      AND EXISTS (SELECT 1 FROM schools b WHERE b.id <> a.id AND upper(b.code) = upper(a.moet_code));
    UPDATE schools a SET code = a.moet_code
    WHERE a.moet_code IS NOT NULL AND a.code <> a.moet_code
      AND NOT EXISTS (SELECT 1 FROM schools b WHERE b.id <> a.id AND upper(b.code) = upper(a.moet_code));
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '199: % trường đổi mã trường theo mã Sở, % bỏ qua vì trùng mã', n, skipped;
END
$$;
--rollback SELECT 1;
