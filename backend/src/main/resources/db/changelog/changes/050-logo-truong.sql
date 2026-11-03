--liquibase formatted sql

--changeset hoangpnd:050-logo-truong
--comment Logo của trường: ảnh nhỏ lưu trong database, tách khỏi bảng schools.

CREATE TABLE school_logos (
    school_id     BIGINT PRIMARY KEY REFERENCES schools (id) ON DELETE CASCADE,
    content_type  VARCHAR(40) NOT NULL,
    data          BYTEA       NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL
);
