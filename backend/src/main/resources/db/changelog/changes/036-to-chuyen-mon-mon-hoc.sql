--liquibase formatted sql

--changeset tutn:036-to-chuyen-mon-mon-hoc
--comment Tổ chuyên môn thuộc một cấp học; môn học có cấp học giảng dạy và thuộc một tổ chuyên môn (để đếm số môn của tổ). Gán dữ liệu mẫu theo cấp THPT.

ALTER TABLE subject_groups ADD COLUMN education_level_id bigint;
ALTER TABLE ONLY subject_groups
    ADD CONSTRAINT fk_subject_groups_education_level FOREIGN KEY (education_level_id) REFERENCES education_levels(id) ON DELETE RESTRICT;
CREATE INDEX idx_subject_groups_education_level ON subject_groups USING btree (education_level_id);

ALTER TABLE subjects ADD COLUMN education_level_id bigint;
ALTER TABLE subjects ADD COLUMN subject_group_id bigint;
ALTER TABLE ONLY subjects
    ADD CONSTRAINT fk_subjects_education_level FOREIGN KEY (education_level_id) REFERENCES education_levels(id) ON DELETE RESTRICT;
-- Tổ còn môn thì không xoá được: phải chuyển môn sang tổ khác trước.
ALTER TABLE ONLY subjects
    ADD CONSTRAINT fk_subjects_subject_group FOREIGN KEY (subject_group_id) REFERENCES subject_groups(id) ON DELETE RESTRICT;
CREATE INDEX idx_subjects_education_level ON subjects USING btree (education_level_id);
CREATE INDEX idx_subjects_subject_group ON subjects USING btree (subject_group_id);

-- Mọi tổ và môn mẫu đều thuộc cấp THPT (phạm vi đồ án).
UPDATE subject_groups SET education_level_id = (SELECT id FROM education_levels WHERE code = 'THPT')
WHERE education_level_id IS NULL;
UPDATE subjects SET education_level_id = (SELECT id FROM education_levels WHERE code = 'THPT')
WHERE education_level_id IS NULL;

-- Môn nào thuộc tổ nào, nối theo mã.
UPDATE subjects s SET subject_group_id = g.id
FROM (VALUES
  ('TOAN',     'TO_TOAN_TIN'),
  ('TINHOC',   'TO_TOAN_TIN'),
  ('NGUVAN',   'TO_NGU_VAN'),
  ('NGOAINGU', 'TO_NGOAI_NGU'),
  ('VATLI',    'TO_KHTN'),
  ('HOAHOC',   'TO_KHTN'),
  ('SINHHOC',  'TO_KHTN'),
  ('CONGNGHE', 'TO_KHTN'),
  ('LICHSU',   'TO_KHXH'),
  ('DIALI',    'TO_KHXH'),
  ('GDKTPL',   'TO_KHXH'),
  ('GDTC',     'TO_GDTC_QP'),
  ('GDQPAN',   'TO_GDTC_QP')
) AS m(subject_code, group_code)
JOIN subject_groups g ON g.code = m.group_code
WHERE s.code = m.subject_code;

--rollback ALTER TABLE subjects DROP COLUMN subject_group_id; ALTER TABLE subjects DROP COLUMN education_level_id; ALTER TABLE subject_groups DROP COLUMN education_level_id;
