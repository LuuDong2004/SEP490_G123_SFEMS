--liquibase formatted sql

--changeset dth:028-vietnamese-seed-labels
--comment Việt hoá nhãn hiển thị của dữ liệu seed: tên/mô tả quyền, vai trò và họ tên tài khoản dev.

-- 013 và 015 đã seed tiếng Việt ngay từ đầu; các dòng dưới đây là phần còn
-- sót lại từ 005, 007 và 010. Chỉ đụng tới name/description/full_name —
-- code là khoá tự nhiên mà mọi join và @PreAuthorize dựa vào, giữ nguyên.
UPDATE permissions SET name = 'Xem người dùng',          description = 'Xem danh sách và chi tiết tài khoản'                          WHERE code = 'users:read';
UPDATE permissions SET name = 'Sửa người dùng',          description = 'Thêm tài khoản, sửa, gán vai trò và đặt lại mật khẩu'         WHERE code = 'users:write';
UPDATE permissions SET name = 'Xoá người dùng',          description = 'Xoá vĩnh viễn một tài khoản'                                  WHERE code = 'users:delete';
UPDATE permissions SET name = 'Xem vai trò',             description = 'Xem danh sách vai trò và các quyền chúng cấp'                 WHERE code = 'roles:read';
UPDATE permissions SET name = 'Sửa vai trò',             description = 'Thêm vai trò và đổi các quyền chúng cấp'                      WHERE code = 'roles:write';
UPDATE permissions SET name = 'Xoá vai trò',             description = 'Xoá vĩnh viễn một vai trò'                                    WHERE code = 'roles:delete';
UPDATE permissions SET name = 'Xem quyền',               description = 'Xem danh mục quyền'                                           WHERE code = 'permissions:read';
UPDATE permissions SET name = 'Xem thông báo',           description = 'Xem thông báo của mình và đánh dấu đã đọc'                    WHERE code = 'notifications:read';
UPDATE permissions SET name = 'Xoá thông báo',           description = 'Xoá vĩnh viễn một thông báo của mình'                         WHERE code = 'notifications:delete';
UPDATE permissions SET name = 'Xem phạm vi dữ liệu',     description = 'Xem mỗi vai trò được chạm tới những dòng nào'                 WHERE code = 'row_level_policies:read';
UPDATE permissions SET name = 'Sửa phạm vi dữ liệu',     description = 'Thu hẹp hoặc mở rộng phạm vi dữ liệu của một vai trò'         WHERE code = 'row_level_policies:write';
UPDATE permissions SET name = 'Xoá phạm vi dữ liệu',     description = 'Xoá một chính sách phạm vi dữ liệu'                           WHERE code = 'row_level_policies:delete';

UPDATE roles SET name = 'Quản trị viên', description = 'Toàn quyền mọi phần của hệ thống, kể cả người dùng và vai trò.'        WHERE code = 'ADMIN';
UPDATE roles SET name = 'Quản lý',       description = 'Quản lý toàn bộ nội dung; xem được nhưng không đổi người dùng và vai trò.' WHERE code = 'MANAGER';
UPDATE roles SET name = 'Người dùng',    description = 'Chỉ xem nội dung.'                                                          WHERE code = 'USER';

UPDATE users SET full_name = 'Quản trị viên hệ thống' WHERE username = 'admin';
UPDATE users SET full_name = 'Quản lý nội dung'       WHERE username = 'manager';
UPDATE users SET full_name = 'Người chỉ xem'          WHERE username = 'viewer';
