--liquibase formatted sql

--changeset dth:044-drop-school-admin-write-scope
--comment Gỡ phạm vi ghi của SCHOOL_ADMIN trên schools — nó vừa là luật chết, vừa không hợp lệ.

-- Migration 043 thêm một `SCOPE` cho SCHOOL_ADMIN trên `schools` action `write`
-- với điều kiện `id = user.schoolId`. Nó sai theo HAI cách độc lập, và hệ thống
-- bắt được ngay ở lần khởi động đầu tiên:
--
-- 1. LUẬT CHẾT. SCHOOL_ADMIN không được cấp mã quyền `schools:write` ở tầng
--    quyền chức năng, nên tầng phạm vi dòng không bao giờ được chạm tới. Đúng
--    cái bẫy mà 043 đã tránh cho UBND_SPECIALIST rồi lại rơi vào ở đây.
--
-- 2. KHÔNG HỢP LỆ. `id` nằm trong `notCheckSafe` của `SchoolRowLevelPolicies`.
--    Vế `WITH CHECK` của một chính sách `write` chạy trên bản ghi SAU khi lưu,
--    nhưng khi TẠO mới thì id chưa tồn tại lúc điều kiện được dựng — nên điều
--    kiện ấy sẽ từ chối mọi bản ghi mới. Bộ kiểm tra lúc nạp đã cách ly nó và
--    ghi lý do vào `invalid_reason`, đúng như thiết kế: một chính sách hỏng bị
--    vô hiệu hoá kèm lý do chứ không làm sập node.
--
-- Xoá hẳn thay vì sửa điều kiện: "quản trị viên trường sửa được hồ sơ trường
-- mình" là một QUYẾT ĐỊNH NGHIỆP VỤ chưa ai chốt. Muốn có thì phải cấp
-- `schools:write` cho vai trò đó và viết một điều kiện dùng trường an toàn cho
-- vế check — không phải `id`. Dựng sẵn một luật không ai bật là để sẵn một chỗ
-- để sai.
DELETE FROM row_level_policy
WHERE resource = 'schools'
  AND action = 'write'
  AND role_id = (SELECT id FROM roles WHERE code = 'SCHOOL_ADMIN')
  AND scope::text LIKE '%user.schoolId%';
