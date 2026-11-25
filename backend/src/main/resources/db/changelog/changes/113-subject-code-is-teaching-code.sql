-- 113: Mã danh mục của môn học LÀ mã môn dạy học
--
-- Form môn học từng có hai ô mã: "Mã" nội bộ (TOAN, MH001 — quy tắc sinh mã
-- MH của Sở) và "Mã môn dạy học" (01, 08 — hai chữ số đi vào đoạn MH của mã
-- tài sản). Người nhập không phân biệt được ô nào là thật. Giờ chỉ còn một:
-- subjects.code lưu đúng teaching_code, form chỉ hỏi mã môn dạy học, và quy
-- tắc sinh mã MH### của Sở tắt — mã môn là hai chữ số, không sinh theo bộ đếm.
--
-- teaching_code đang duy nhất trên toàn bảng (đã kiểm: không trùng, không
-- null) nên việc chép sang code không vấp uq_subjects_code.

-- Mã danh mục = mã môn dạy học cho mọi môn đã có.
UPDATE subjects SET code = teaching_code;

-- Tắt quy tắc sinh mã MH### của Sở cho subjects — giống 111 tắt LTB của loại
-- thiết bị: giữ dòng để tra cứu, chỉ ngừng áp dụng.
UPDATE code_rules SET active = FALSE WHERE target = 'subjects';
