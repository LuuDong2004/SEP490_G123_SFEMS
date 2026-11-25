--liquibase formatted sql

--changeset luudong:291-chuan-csvc-thpt-day-du splitStatements:false
--comment Chuẩn CSVC THPT đầy đủ theo 14/VBHN-BGDĐT (TT 13/2020 sửa bởi TT 23/2024): Điều 18, 19, 20 và Phụ lục IV
-- 291 (trưởng nhóm 24/11/2026: "chuẩn cơ sở vật chất này đủ chưa"). Số nạp ở 203 / 282 là GỢI Ý, mới 11 loại và có chỗ
-- sai: thư viện 0,60 m²/học sinh là mức TỐI THIỂU và chỉ tính trên 30% – 50% học sinh (lấy cận dưới 30%), không phải mọi
-- học sinh ở mức độ 1; "1 phòng học/lớp" ở mức độ 1 không có trong văn bản.
--
-- KHÔNG nạp (mô hình chưa có số đầu vào): m²/học sinh của MỘT phòng học, phòng bộ môn (tính theo học sinh trong phòng,
-- không phải tổng), m²/người của phòng họp, m²/giáo viên, m²/xe, số thiết bị vệ sinh, số phòng theo số tổ chuyên môn, nhà
-- bếp / nhà ăn / nội trú / nhà văn hoá theo học sinh ăn ở nội trú, diện tích đất, tỉ lệ kiên cố, mật độ sử dụng đất.
ALTER TABLE facility_standard_rules
    ADD COLUMN large_class_from INTEGER
        CONSTRAINT ck_facility_standard_rules_large_class CHECK (large_class_from IS NULL OR large_class_from >= 0),
    ADD COLUMN large_min_count INTEGER
        CONSTRAINT ck_facility_standard_rules_large_count CHECK (large_min_count IS NULL OR large_min_count >= 0),
    ADD COLUMN student_percent NUMERIC(5, 2)
        CONSTRAINT ck_facility_standard_rules_percent CHECK (student_percent IS NULL OR student_percent > 0 AND student_percent <= 100),
    ADD COLUMN only_if_present BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN subject_rooms BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT ck_facility_standard_rules_large CHECK ((large_class_from IS NULL) = (large_min_count IS NULL));

-- Ba phòng học bộ môn còn thiếu (khoản 1 Điều 4 TT 14/2020/TT-BGDĐT) — bản sao cấu hình của Phòng học bộ môn Công nghệ.
INSERT INTO room_types (code, name, sort_order, active, created_at, group_id, kind, levels, standard, legal_basis,
                        loanable, functional, params)
SELECT v.code, v.name, v.sort_order, TRUE, now(), t.group_id, t.kind, t.levels, t.standard, t.legal_basis, t.loanable,
       t.functional, t.params
FROM room_types t,
     (VALUES ('PHONG_HOC_BO_MON_AM_NHAC', 'Phòng học bộ môn Âm nhạc', 523),
             ('PHONG_HOC_BO_MON_MI_THUAT', 'Phòng học bộ môn Mĩ thuật', 524),
             ('PHONG_HOC_BO_MON_KHOA_HOC_XA_HOI', 'Phòng học bộ môn Khoa học xã hội', 528)) AS v (code, name, sort_order)
WHERE t.code = 'PHONG_HOC_BO_MON_CONG_NGHE'
ON CONFLICT (code) DO NOTHING;

-- Loại cũ (đã ngừng dùng) làm chỗ đứng cho quy tắc TỔNG số phòng học bộ môn.
UPDATE room_types SET name = 'Phòng học bộ môn (tính chung các môn)', sort_order = 516 WHERE code = 'PHONG_BO_MON';

INSERT INTO facility_standard_rules (code, name, sort_order, active, note, room_type_id, level_code, tier, min_count,
                                     count_per_class, min_room_area, area_per_student, min_total_area, large_class_from,
                                     large_min_count, student_percent, only_if_present, subject_rooms, legal_basis,
                                     created_at)
SELECT rt.code || '.THPT.' || s.tier, rt.name,
       COALESCE(g.sort_order, 0) * 10000 + COALESCE(rt.sort_order, 0) * 10 + 6
           + CASE s.tier WHEN 'MIN' THEN 0 WHEN 'LEVEL1' THEN 1 ELSE 2 END,
       TRUE, NULL, rt.id, 'THPT', s.tier, s.min_count, s.count_per_class, s.min_room_area, s.area_per_student,
       s.min_total_area, s.large_class_from, s.large_min_count, s.student_percent, s.only_if_present, s.subject_rooms,
       s.legal_basis, now()
FROM (VALUES
    -- Khối phòng hành chính quản trị (khoản 1 Điều 18)
    ('PHONG_HIEU_TRUONG', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 1 Điều 18'),
    ('PHONG_PHO_HIEU_TRUONG', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 1 Điều 18'),
    ('VAN_PHONG_TRUONG', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 1 Điều 18'),
    ('PHONG_BAO_VE', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 1 Điều 18'),
    ('KHU_VE_SINH_GIAO_VIEN_CAN_BO_NHAN_VIEN', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 1 Điều 18'),
    ('KHU_DE_XE_CUA_GIAO_VIEN_CAN_BO_NHAN_VIEN', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 1 Điều 18'),
    -- Khối phòng học tập (khoản 2 Điều 18, 19; khoản 1 Điều 20; Phụ lục IV mục 1)
    ('PHONG_HOC', 'MIN', NULL::INTEGER, 0.6::NUMERIC, 45::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 2 Điều 18 và Phụ lục IV, sửa bởi TT 23/2024/TT-BGDĐT'),
    ('PHONG_BO_MON', 'MIN', 5::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, TRUE, 'TT 13/2020/TT-BGDĐT, khoản 2 Điều 18, sửa bởi TT 23/2024/TT-BGDĐT'),
    ('PHONG_BO_MON', 'LEVEL1', 6::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 30::INTEGER, 8::INTEGER, NULL::NUMERIC, FALSE, TRUE, 'TT 13/2020/TT-BGDĐT, khoản 2 Điều 19, sửa bởi TT 23/2024/TT-BGDĐT'),
    ('PHONG_BO_MON', 'LEVEL2', 8::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, TRUE, 'TT 13/2020/TT-BGDĐT, khoản 1 Điều 20, sửa bởi TT 23/2024/TT-BGDĐT'),
    ('PHONG_HOC_BO_MON_AM_NHAC', 'MIN', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_HOC_BO_MON_MI_THUAT', 'MIN', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_HOC_BO_MON_CONG_NGHE', 'MIN', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_MAY', 'MIN', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_HOC_BO_MON_NGOAI_NGU', 'MIN', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_CHUC_NANG', 'MIN', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_BO_MON_VAT_LY', 'MIN', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_BO_MON_HOA_HOC', 'MIN', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_BO_MON_SINH_HOC', 'MIN', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_HOC_BO_MON_KHOA_HOC_XA_HOI', 'LEVEL1', NULL::INTEGER, NULL::NUMERIC, 60::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    -- Khối phòng hỗ trợ học tập (khoản 3 Điều 18; khoản 2 Điều 20; Phụ lục IV mục 2)
    ('THU_VIEN', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, 0.6::NUMERIC, 60::NUMERIC, NULL::INTEGER, NULL::INTEGER, 30::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 3 Điều 18 và Phụ lục IV, sửa bởi TT 23/2024/TT-BGDĐT'),
    ('KHO', 'MIN', 1::INTEGER, NULL::NUMERIC, 48::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 3 Điều 18 và Phụ lục IV'),
    ('PHONG_TU_VAN_HOC_DUONG_VA_HO_TRO_GIAO', 'MIN', 1::INTEGER, NULL::NUMERIC, 24::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 3 Điều 18 và Phụ lục IV'),
    ('PHONG_TRUYEN_THONG', 'MIN', 1::INTEGER, NULL::NUMERIC, 48::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 3 Điều 18 và Phụ lục IV'),
    ('PHONG_DOAN_THANH_NIEN', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, 0.03::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 3 Điều 18 và Phụ lục IV'),
    ('PHONG_KET_HOP_TRUYEN_THONG_VOI_PHONG', 'MIN', NULL::INTEGER, NULL::NUMERIC, 54::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, Phụ lục IV'),
    ('PHONG_TRUYEN_THONG', 'LEVEL2', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 2 Điều 20'),
    ('PHONG_DOAN_THANH_NIEN', 'LEVEL2', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 2 Điều 20'),
    -- Khối phụ trợ (khoản 4 Điều 18; khoản 3 Điều 20; Phụ lục IV mục 3)
    ('PHONG_HOP', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 4 Điều 18'),
    ('PHONG_CAC_TO_CHUYEN_MON', 'MIN', 1::INTEGER, NULL::NUMERIC, 30::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 30::INTEGER, 2::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 4 Điều 18 và Phụ lục IV'),
    ('PHONG_Y_TE', 'MIN', 1::INTEGER, NULL::NUMERIC, 24::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 4 Điều 18 và Phụ lục IV'),
    ('NHA_KHO', 'MIN', 1::INTEGER, NULL::NUMERIC, 48::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 4 Điều 18 và Phụ lục IV'),
    ('KHU_DE_XE_HOC_SINH', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 4 Điều 18'),
    ('KHU_VE_SINH_HOC_SINH', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, 0.06::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 4 Điều 18 và Phụ lục IV'),
    ('CONG_HANG_RAO', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 4 Điều 18'),
    ('PHONG_NGHI_GIAO_VIEN', 'LEVEL2', 1::INTEGER, 0.1::NUMERIC, 12::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 3 Điều 20 và Phụ lục IV, sửa bởi TT 23/2024/TT-BGDĐT'),
    ('PHONG_GIAO_VIEN', 'LEVEL2', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 3 Điều 20, sửa bởi TT 23/2024/TT-BGDĐT'),
    -- Khu sân chơi, thể dục thể thao (khoản 5 Điều 18; khoản 4 Điều 20; Phụ lục IV mục 4)
    ('SAN_CHOI_CHUNG', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, 1.5::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 5 Điều 18 và Phụ lục IV'),
    ('SAN_THE_DUC_THE_THAO', 'MIN', 1::INTEGER, NULL::NUMERIC, NULL::NUMERIC, 0.35::NUMERIC, 350::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 5 Điều 18 và Phụ lục IV'),
    ('NHA_DA_NANG', 'LEVEL2', 1::INTEGER, NULL::NUMERIC, 450::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 4 Điều 20 và Phụ lục IV'),
    -- Khối phục vụ sinh hoạt: chỉ trường có nấu ăn, nội trú (khoản 6 Điều 18; Phụ lục IV mục 5)
    ('KHO_BEP_THUC_PHAM', 'MIN', NULL::INTEGER, NULL::NUMERIC, 10::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 6 Điều 18 và Phụ lục IV'),
    ('KHO_BEP_LUONG_THUC', 'MIN', NULL::INTEGER, NULL::NUMERIC, 12::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 6 Điều 18 và Phụ lục IV'),
    ('PHONG_QUAN_LY_HOC_SINH', 'MIN', NULL::INTEGER, NULL::NUMERIC, 9::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 6 Điều 18 và Phụ lục IV'),
    ('PHONG_SINH_HOAT_CHUNG', 'MIN', NULL::INTEGER, NULL::NUMERIC, 36::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, TRUE, FALSE, 'TT 13/2020/TT-BGDĐT, khoản 6 Điều 18 và Phụ lục IV')
) AS s (type_code, tier, min_count, count_per_class, min_room_area, area_per_student, min_total_area, large_class_from,
        large_min_count, student_percent, only_if_present, subject_rooms, legal_basis)
JOIN room_types rt ON rt.code = s.type_code
LEFT JOIN facility_groups g ON g.id = rt.group_id
-- Quy tắc Sở đã sửa tay (không còn ghi chú "Số gợi ý…") giữ nguyên.
ON CONFLICT (room_type_id, level_code, tier) DO UPDATE SET
    min_count = EXCLUDED.min_count, count_per_class = EXCLUDED.count_per_class, min_room_area = EXCLUDED.min_room_area,
    area_per_student = EXCLUDED.area_per_student, min_total_area = EXCLUDED.min_total_area,
    student_percent = EXCLUDED.student_percent, legal_basis = EXCLUDED.legal_basis, note = NULL, updated_at = now()
WHERE facility_standard_rules.note LIKE 'Số gợi ý khi nạp%';

-- Hai dòng gợi ý không có trong văn bản: ngừng dùng, không xoá (Sở xem lại được, bộ chấm bỏ qua).
UPDATE facility_standard_rules
SET active = FALSE, updated_at = now(), note = 'Ngừng dùng: không có trong 14/VBHN-BGDĐT'
WHERE code IN ('PHONG_HOC.THPT.LEVEL1', 'THU_VIEN.THPT.LEVEL1') AND note LIKE 'Số gợi ý khi nạp%';

--rollback UPDATE facility_standard_rules SET active = TRUE WHERE code IN ('PHONG_HOC.THPT.LEVEL1', 'THU_VIEN.THPT.LEVEL1');
--rollback ALTER TABLE facility_standard_rules DROP COLUMN large_class_from, DROP COLUMN large_min_count, DROP COLUMN student_percent, DROP COLUMN only_if_present, DROP COLUMN subject_rooms;

--changeset luudong:291-ghi-chu-phong-ket-hop
UPDATE facility_standard_rules SET note = 'Được ghép phòng truyền thống với phòng Đoàn', updated_at = now()
WHERE code IN ('PHONG_TRUYEN_THONG.THPT.MIN', 'PHONG_DOAN_THANH_NIEN.THPT.MIN') AND note IS NULL;
UPDATE facility_standard_rules SET note = 'Bố trí riêng, không tính phòng ghép', updated_at = now()
WHERE code IN ('PHONG_TRUYEN_THONG.THPT.LEVEL2', 'PHONG_DOAN_THANH_NIEN.THPT.LEVEL2') AND note IS NULL;
--rollback empty

--changeset luudong:291-van-ban-can-cu splitStatements:false
--comment Văn bản căn cứ của chuẩn CSVC chọn từ danh mục Văn bản căn cứ, legal_basis chỉ còn điều khoản
CREATE TABLE facility_standard_rule_documents (
    rule_id           BIGINT NOT NULL
        CONSTRAINT fk_facility_standard_rule_documents_rule REFERENCES facility_standard_rules (id) ON DELETE CASCADE,
    legal_document_id BIGINT NOT NULL
        CONSTRAINT fk_facility_standard_rule_documents_document REFERENCES legal_documents (id) ON DELETE RESTRICT,
    CONSTRAINT pk_facility_standard_rule_documents PRIMARY KEY (rule_id, legal_document_id)
);
CREATE INDEX idx_facility_standard_rule_documents_document ON facility_standard_rule_documents (legal_document_id);

-- Số hiệu đang ghi trong câu căn cứ (viết đủ hoặc viết tắt "13/2020").
INSERT INTO facility_standard_rule_documents (rule_id, legal_document_id)
SELECT r.id, d.id
FROM facility_standard_rules r
JOIN legal_documents d ON r.legal_basis LIKE '%' || split_part(d.code, '/', 1) || '/' || split_part(d.code, '/', 2) || '%'
    AND (r.legal_basis LIKE '%' || d.code || '%'
         OR r.legal_basis ~ ('(^|[^0-9])' || split_part(d.code, '/', 1) || '/' || split_part(d.code, '/', 2) || '($|[^/0-9])'));

-- Câu căn cứ còn lại điều khoản: bỏ số hiệu và "sửa bởi …".
UPDATE facility_standard_rules
SET legal_basis = NULLIF(btrim(regexp_replace(regexp_replace(legal_basis,
        ',?\s*sửa (đổi )?bởi (TT )?[0-9]+/[0-9]{4}/TT-BGDĐT', '', 'g'),
        '(TT )?[0-9]+/[0-9]{4}/TT-BGDĐT,?\s*', '', 'g'), ' ,;'), '')
WHERE legal_basis IS NOT NULL
  AND EXISTS (SELECT 1 FROM facility_standard_rule_documents x WHERE x.rule_id = facility_standard_rules.id);
UPDATE facility_standard_rules SET legal_basis = upper(left(legal_basis, 1)) || substr(legal_basis, 2) WHERE legal_basis IS NOT NULL;
--rollback DROP TABLE facility_standard_rule_documents;
