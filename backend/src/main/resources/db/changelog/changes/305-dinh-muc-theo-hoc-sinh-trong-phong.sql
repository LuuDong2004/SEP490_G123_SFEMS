--liquibase formatted sql

--changeset luudong:305-dinh-muc-theo-hoc-sinh-trong-phong
--comment Danh mục tối thiểu THPT: "01/HS" là mỗi học sinh TRONG MỘT phòng học bộ môn / một lớp (phụ lục: tính cho 1 lớp 45 HS), không phải mỗi học sinh của cả trường; thiết bị của mục "phòng thực hành tin học", "hệ thống thiết bị dạy học ngoại ngữ chuyên dụng" tính cho mỗi phòng.
-- Trước đây máy tính phòng Tin của trường 2.152 HS bị đòi 2.152 máy. Căn cứ mới PER_ROOM_STUDENT (NormBasis):
--   cần = số lượng × ⌈45 ÷ cỡ nhóm⌉ × số phòng bộ môn của môn (chưa khai phòng thì 1).
-- Dòng của hai mục phòng đang "theo trường" đổi sang PER_ROOM (× số phòng). Dòng không ghi số lượng giữ nguyên.
-- Chỉ sửa cách đọc phụ lục (dòng đang hiệu lực của bộ THPT), không đổi số lượng, chữ "Số lượng" gốc giữ nguyên.
ALTER TABLE equipment_norms DROP CONSTRAINT ck_equipment_norms_basis;
ALTER TABLE equipment_norms ADD CONSTRAINT ck_equipment_norms_basis
    CHECK (norm_basis IN ('PER_CLASS', 'PER_SCHOOL', 'PER_STUDENT', 'PER_TEACHER', 'PER_ROOM', 'PER_ROOM_STUDENT'));

-- 1. "01/HS", "01/02HS", "01/03HS", "01/4HS- 6HS" của bộ THPT → mỗi học sinh trong một phòng / một lớp.
UPDATE equipment_norms n SET norm_basis = 'PER_ROOM_STUDENT', updated_at = now()
FROM equipment_standards st JOIN education_levels lv ON lv.id = st.education_level_id
WHERE st.id = n.standard_id AND lv.code = 'THPT' AND n.effective_to IS NULL AND n.norm_basis = 'PER_STUDENT';

-- 2. Thiết bị của phòng thực hành tin học, phòng ngoại ngữ chuyên dụng đang tính một cho cả trường → mỗi phòng.
UPDATE equipment_norms n SET norm_basis = 'PER_ROOM', updated_at = now()
FROM equipment_standards st JOIN education_levels lv ON lv.id = st.education_level_id
WHERE st.id = n.standard_id AND lv.code = 'THPT' AND n.effective_to IS NULL AND n.norm_basis = 'PER_SCHOOL'
  AND (n.section_name ILIKE 'Phòng thực hành tin học%'
       OR n.section_name ILIKE 'Hệ thống thiết bị dạy học ngoại ngữ chuyên dụng%');
--rollback UPDATE equipment_norms n SET norm_basis = 'PER_SCHOOL' FROM equipment_standards st JOIN education_levels lv ON lv.id = st.education_level_id WHERE st.id = n.standard_id AND lv.code = 'THPT' AND n.effective_to IS NULL AND n.norm_basis = 'PER_ROOM' AND (n.section_name ILIKE 'Phòng thực hành tin học%' OR n.section_name ILIKE 'Hệ thống thiết bị dạy học ngoại ngữ chuyên dụng%');
--rollback UPDATE equipment_norms SET norm_basis = 'PER_STUDENT' WHERE norm_basis = 'PER_ROOM_STUDENT';
--rollback ALTER TABLE equipment_norms DROP CONSTRAINT ck_equipment_norms_basis; ALTER TABLE equipment_norms ADD CONSTRAINT ck_equipment_norms_basis CHECK (norm_basis IN ('PER_CLASS', 'PER_SCHOOL', 'PER_STUDENT', 'PER_TEACHER', 'PER_ROOM'));
