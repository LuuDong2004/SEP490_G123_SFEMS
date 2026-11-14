--liquibase formatted sql

-- Cấp học MẦM NON.
--
-- Phạm vi hồ sơ (Chương V mục 3.4: 1.670 cơ sở giáo dục) gồm cả mầm non, nhưng danh mục cấp học
-- seed ở `013` chỉ có ba cấp phổ thông. Trường mầm non được quản lý như mọi trường khác: cùng cây
-- cơ quan quản lý (UBND phường/xã, như Tiểu học và THCS), cùng cơ sở - khối nhà - phòng, cán bộ,
-- lớp học, thiết bị và các loại phiếu.
--
-- Hai chỗ mầm non KHÁC các cấp phổ thông, và cả hai đều là dữ liệu chứ không phải code:
--
--   * Không có "lớp 1…12" — lớp chia theo NHÓM TUỔI: nhà trẻ, rồi ba lớp mẫu giáo Mầm · Chồi · Lá.
--     Mã khối cố ý KHÔNG mang chữ số: phép tính định mức đọc số lớp từ mã khối (`LOP_6` → 6), nên
--     một mã như `MG_3_4` sẽ bị hiểu là "lớp 3".
--   * Không dạy theo môn, nên không gắn môn nào với cấp này; mã tài sản dùng `00` (chưa khai môn)
--     ở thành phần MH như mọi thiết bị dùng chung.
--
-- CHƯA có danh mục thiết bị tối thiểu của mầm non (văn bản riêng, không thuộc TT 37 / 38 / 39):
-- trường mầm non ghi tăng thiết bị qua "thiết bị ngoài danh mục" (087) cho tới khi nhập danh mục đó.

--changeset qltb:104-education-level-mam-non
INSERT INTO education_levels (code, name, short_name, sort_order, active, created_at)
SELECT 'MN', 'Mầm non', 'MN', 5, TRUE, now()
WHERE NOT EXISTS (SELECT 1 FROM education_levels WHERE code = 'MN');

-- Nhường bốn vị trí đầu cho các khối mầm non: danh sách khối lớp xếp theo `sort_order`, và mầm non
-- đứng trước lớp 1. Chỉ dời các khối seed ở `023` còn nguyên thứ tự gốc.
--changeset qltb:104-grades-make-room
UPDATE grades
SET sort_order = sort_order + 10
WHERE code ~ '^LOP_[0-9]+$'
  AND sort_order = CAST(substring(code FROM 5) AS INTEGER);

--changeset qltb:104-grades-mam-non
INSERT INTO grades (code, name, sort_order, active, education_level_id, created_at)
SELECT v.code, v.name, v.sort_order, TRUE, e.id, now()
FROM (VALUES
        ('NHA_TRE', 'Nhà trẻ', 1),
        ('MG_MAM', 'Mầm (3 – 4 tuổi)', 2),
        ('MG_CHOI', 'Chồi (4 – 5 tuổi)', 3),
        ('MG_LA', 'Lá (5 – 6 tuổi)', 4)
     ) AS v (code, name, sort_order)
JOIN education_levels e ON e.code = 'MN'
WHERE NOT EXISTS (SELECT 1 FROM grades g WHERE g.code = v.code);
