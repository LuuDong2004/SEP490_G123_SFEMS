--liquibase formatted sql

--changeset dth:036-create-school-logos
--comment Logo của trường: ảnh nhỏ lưu trong database, tách khỏi bảng schools.

CREATE TABLE school_logos (
    school_id     BIGINT PRIMARY KEY REFERENCES schools (id) ON DELETE CASCADE,
    content_type  VARCHAR(40) NOT NULL,
    data          BYTEA       NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL
);
