--liquibase formatted sql

--changeset luudong:317-bo-dich-quy-tac-ma-cong-trinh
--comment Bỏ facility_works khỏi CHECK đích của quy tắc mã trường: bảng công trình đã xoá ở 285 (kèm các dòng quy tắc), SchoolCodeService chỉ còn năm đích.
DELETE FROM school_code_rules WHERE target = 'facility_works';
ALTER TABLE school_code_rules DROP CONSTRAINT ck_school_code_rules_target;
ALTER TABLE school_code_rules
    ADD CONSTRAINT ck_school_code_rules_target
        CHECK (target IN ('rooms', 'buildings', 'campuses', 'staff', 'subject_teams'));
--rollback ALTER TABLE school_code_rules DROP CONSTRAINT ck_school_code_rules_target;
--rollback ALTER TABLE school_code_rules ADD CONSTRAINT ck_school_code_rules_target CHECK (target IN ('rooms', 'buildings', 'campuses', 'staff', 'subject_teams', 'facility_works'));
