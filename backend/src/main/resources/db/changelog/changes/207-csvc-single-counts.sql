--liquibase formatted sql

--changeset dth:207-csvc-single-counts
-- Một nguồn cho học sinh, lớp: các lớp đang dùng của năm học hiện hành (school_classes). Bỏ hai chỗ nhập tay song song
-- — số ở hồ sơ trường (061) và số ở từng cơ sở (201) — vì các báo cáo lấy chỗ này chỗ kia ra số khác nhau. Chia theo
-- cơ sở nay tính từ phòng học của lớp (FacilityCounting.CLASS_COUNTS_BY_CAMPUS). Ràng buộc CHECK của các cột đi theo
-- cột; không view / hàm nào dùng chúng.
ALTER TABLE campuses
    DROP COLUMN IF EXISTS student_count,
    DROP COLUMN IF EXISTS class_count;

ALTER TABLE schools
    DROP COLUMN IF EXISTS student_count,
    DROP COLUMN IF EXISTS class_count;

--rollback ALTER TABLE schools ADD COLUMN class_count INTEGER CHECK (class_count IS NULL OR class_count >= 0), ADD COLUMN student_count INTEGER CHECK (student_count IS NULL OR student_count >= 0);
--rollback ALTER TABLE campuses ADD COLUMN student_count INTEGER CONSTRAINT ck_campuses_students CHECK (student_count IS NULL OR student_count >= 0), ADD COLUMN class_count INTEGER CONSTRAINT ck_campuses_classes CHECK (class_count IS NULL OR class_count >= 0);
