--liquibase formatted sql

--changeset qltb:230-db-rls-role splitStatements:false
-- RLS PostgreSQL (lớp chặn thứ 4, docs/kien-truc/03 mục "Lớp CSDL"): vai `qltb_app` KHÔNG superuser, KHÔNG
-- BYPASSRLS. Superuser (và vai BYPASSRLS) bỏ qua RLS kể cả khi FORCE, nên khi người đang gọi bị giới hạn theo
-- trường, ứng dụng hạ vai bằng `set_config('role', 'qltb_app', false)` (RowSecurityDataSource).
-- Vai là của cả cụm PostgreSQL (dùng chung giữa các CSDL), quyền trên bảng là của CSDL này.
-- Tài khoản chạy Liquibase (= tài khoản ứng dụng) không tạo được vai thì chỉ báo NOTICE và bỏ qua: ứng dụng tự
-- phát hiện, không hạ vai, ghi cảnh báo — không làm hỏng triển khai.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qltb_app') THEN
        IF NOT (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname = current_user) THEN
            RAISE NOTICE 'Không tạo được vai qltb_app (cần superuser hoặc CREATEROLE) — RLS chỉ áp khi tài khoản ứng dụng không phải superuser';
            RETURN;
        END IF;
        CREATE ROLE qltb_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;

    IF NOT pg_has_role(current_user, 'qltb_app', 'MEMBER') THEN
        BEGIN
            EXECUTE format('GRANT qltb_app TO %I', current_user);
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'Không gán được qltb_app cho % — cần GRANT qltb_app TO % bằng tay', current_user, current_user;
        END;
    END IF;

    GRANT USAGE ON SCHEMA public TO qltb_app;
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO qltb_app;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO qltb_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO qltb_app;
    -- Bảng / sequence / hàm do changelog sau này tạo (cùng tài khoản chạy Liquibase) tự có quyền.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES TO qltb_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO qltb_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO qltb_app;
END $$;
