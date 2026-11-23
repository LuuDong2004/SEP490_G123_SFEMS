--liquibase formatted sql

--changeset qltb:232-user-subtype-tables splitStatements:false
-- Tách tài khoản theo loại thành bảng con JOINED (docs/kien-truc/11, theo khung qlvb-app): users chỉ giữ phần đăng
-- nhập; trường / cơ quan quản lý và phần riêng của từng loại sang bảng con, khoá chính trùng users.id.
--   user_systems  quản trị: quản trị cấp cao, IP được đăng nhập riêng, chức danh, ghi chú
--   user_sos      Sở: cơ quan (phải là Sở), chức vụ, chức danh, điện thoại
--   user_ubnds    UBND phường / xã: cơ quan (không phải Sở), chức vụ, chức danh, điện thoại
--   user_schools  trường: trường, chức vụ, chức danh
-- Chép từ users (cột user_type của 218) rồi mới bỏ cột cũ ở 233. Chức vụ suy từ vai (*_LEADER → LEADER).

-- Khoá ngoại kép (managing_body_id, body_type) → departments_of_education (id, type): cơ quan của tài khoản Sở luôn
-- là Sở, của tài khoản UBND không bao giờ là Sở — kể cả khi ai đó đổi loại cơ quan về sau (ON UPDATE CASCADE rồi
-- CHECK của bảng con chặn).
ALTER TABLE departments_of_education
    ADD CONSTRAINT uq_departments_of_education_id_type UNIQUE (id, type);

CREATE TABLE user_systems (
    id             BIGINT       NOT NULL CONSTRAINT pk_user_systems PRIMARY KEY
        CONSTRAINT fk_user_systems_user REFERENCES users (id) ON DELETE CASCADE,
    is_super_admin BOOLEAN      NOT NULL DEFAULT FALSE,
    allowed_ips    VARCHAR(1000),
    job_title      VARCHAR(255),
    note           VARCHAR(500)
);

CREATE TABLE user_sos (
    id               BIGINT      NOT NULL CONSTRAINT pk_user_sos PRIMARY KEY
        CONSTRAINT fk_user_sos_user REFERENCES users (id) ON DELETE CASCADE,
    managing_body_id BIGINT      NOT NULL,
    body_type        VARCHAR(32) NOT NULL DEFAULT 'SO' CONSTRAINT ck_user_sos_body_type CHECK (body_type = 'SO'),
    position         VARCHAR(16) NOT NULL DEFAULT 'STAFF' CONSTRAINT ck_user_sos_position
        CHECK (position IN ('LEADER', 'STAFF')),
    job_title        VARCHAR(255),
    work_phone       VARCHAR(20),
    CONSTRAINT fk_user_sos_body FOREIGN KEY (managing_body_id, body_type)
        REFERENCES departments_of_education (id, type) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX idx_user_sos_body ON user_sos (managing_body_id);

CREATE TABLE user_ubnds (
    id               BIGINT      NOT NULL CONSTRAINT pk_user_ubnds PRIMARY KEY
        CONSTRAINT fk_user_ubnds_user REFERENCES users (id) ON DELETE CASCADE,
    managing_body_id BIGINT      NOT NULL,
    body_type        VARCHAR(32) NOT NULL DEFAULT 'UBND' CONSTRAINT ck_user_ubnds_body_type CHECK (body_type <> 'SO'),
    position         VARCHAR(16) NOT NULL DEFAULT 'STAFF' CONSTRAINT ck_user_ubnds_position
        CHECK (position IN ('LEADER', 'STAFF')),
    job_title        VARCHAR(255),
    work_phone       VARCHAR(20),
    CONSTRAINT fk_user_ubnds_body FOREIGN KEY (managing_body_id, body_type)
        REFERENCES departments_of_education (id, type) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX idx_user_ubnds_body ON user_ubnds (managing_body_id);

-- Ứng dụng không ghi body_type (không có trong entity): trigger điền theo loại thật của cơ quan, rồi CHECK + khoá
-- ngoại kép quyết định có nhận không. UBND gồm cả cơ quan loại KHAC (cách 218 đã xếp).
CREATE OR REPLACE FUNCTION public.user_agency_body_type() RETURNS trigger
    LANGUAGE plpgsql
AS $$
BEGIN
    NEW.body_type := (SELECT d.type FROM departments_of_education d WHERE d.id = NEW.managing_body_id);
    RETURN NEW;
END $$;

CREATE TRIGGER trg_user_sos_body_type BEFORE INSERT OR UPDATE OF managing_body_id ON user_sos
    FOR EACH ROW EXECUTE FUNCTION public.user_agency_body_type();
CREATE TRIGGER trg_user_ubnds_body_type BEFORE INSERT OR UPDATE OF managing_body_id ON user_ubnds
    FOR EACH ROW EXECUTE FUNCTION public.user_agency_body_type();

CREATE TABLE user_schools (
    id        BIGINT      NOT NULL CONSTRAINT pk_user_schools PRIMARY KEY
        CONSTRAINT fk_user_schools_user REFERENCES users (id) ON DELETE CASCADE,
    school_id BIGINT      NOT NULL CONSTRAINT fk_user_schools_school REFERENCES schools (id) ON DELETE RESTRICT,
    position  VARCHAR(16) NOT NULL DEFAULT 'STAFF' CONSTRAINT ck_user_schools_position
        CHECK (position IN ('LEADER', 'STAFF')),
    job_title VARCHAR(255)
);
CREATE INDEX idx_user_schools_school ON user_schools (school_id);

-- Chức vụ theo vai: có vai *_LEADER là lãnh đạo.
CREATE TEMP TABLE tmp_user_leaders ON COMMIT DROP AS
SELECT DISTINCT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code LIKE '%\_LEADER';

-- Quản trị đang có vai ADMIN = quản trị cấp cao (giữ nguyên quyền hôm nay); tài khoản SYSTEM khác (vd. viewer) thì không.
INSERT INTO user_systems (id, is_super_admin)
SELECT u.id, EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                     WHERE ur.user_id = u.id AND r.code = 'ADMIN')
FROM users u WHERE u.user_type = 'SYSTEM';

INSERT INTO user_sos (id, managing_body_id, position)
SELECT u.id, u.managing_body_id,
       CASE WHEN u.id IN (SELECT user_id FROM tmp_user_leaders) THEN 'LEADER' ELSE 'STAFF' END
FROM users u WHERE u.user_type = 'SO';

INSERT INTO user_ubnds (id, managing_body_id, position)
SELECT u.id, u.managing_body_id,
       CASE WHEN u.id IN (SELECT user_id FROM tmp_user_leaders) THEN 'LEADER' ELSE 'STAFF' END
FROM users u WHERE u.user_type = 'UBND';

INSERT INTO user_schools (id, school_id, position)
SELECT u.id, u.school_id,
       CASE WHEN u.id IN (SELECT user_id FROM tmp_user_leaders) THEN 'LEADER' ELSE 'STAFF' END
FROM users u WHERE u.user_type = 'SCHOOL';

-- Mỗi tài khoản đúng một dòng ở đúng một bảng con — sai thì dừng triển khai, không đi tiếp với dữ liệu lệch.
DO $$
DECLARE missing BIGINT;
BEGIN
    SELECT count(*) INTO missing FROM users u
    WHERE (SELECT count(*) FROM (SELECT id FROM user_systems UNION ALL SELECT id FROM user_sos
                                 UNION ALL SELECT id FROM user_ubnds UNION ALL SELECT id FROM user_schools) c
           WHERE c.id = u.id) <> 1;
    IF missing > 0 THEN
        RAISE EXCEPTION '% tài khoản không nằm đúng một bảng con', missing;
    END IF;
END $$;

-- Bảng mới cần quyền cho vai RLS của ứng dụng (230): ALTER DEFAULT PRIVILEGES chỉ phủ bảng do đúng tài khoản đó tạo.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qltb_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON user_systems, user_sos, user_ubnds, user_schools TO qltb_app;
    END IF;
END $$;
--rollback DROP TABLE user_schools; DROP TABLE user_ubnds; DROP TABLE user_sos; DROP TABLE user_systems; DROP FUNCTION public.user_agency_body_type(); ALTER TABLE departments_of_education DROP CONSTRAINT uq_departments_of_education_id_type;
