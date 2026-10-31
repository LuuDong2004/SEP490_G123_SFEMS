--liquibase formatted sql

--changeset luudong:004-seed-quyen-he-thong
--comment Mã quyền chức năng của phần Hệ thống (HT-04, HT-05): tài khoản, vai trò, danh mục quyền, phạm vi dữ liệu. Quyền của các mảng khác do người phụ trách mảng đó seed. system_permission = TRUE: quyền do code kiểm, không xoá được trên màn hình.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('users:read',                'Xem người dùng',      'Xem danh sách và chi tiết tài khoản',                          TRUE),
  ('users:write',               'Sửa người dùng',      'Thêm tài khoản, sửa, khoá, gán vai trò và đặt lại mật khẩu',  TRUE),
  ('users:delete',              'Xoá người dùng',      'Xoá vĩnh viễn một tài khoản',                                  TRUE),
  ('roles:read',                'Xem vai trò',         'Xem danh sách vai trò và các quyền chúng cấp',                 TRUE),
  ('roles:write',               'Sửa vai trò',         'Thêm vai trò và đổi các quyền chúng cấp',                      TRUE),
  ('roles:delete',              'Xoá vai trò',         'Xoá vĩnh viễn một vai trò',                                    TRUE),
  ('permissions:read',          'Xem quyền',           'Xem danh mục quyền',                                           TRUE),
  ('row_level_policies:read',   'Xem phạm vi dữ liệu', 'Xem mỗi vai trò được chạm tới những dòng nào',                 TRUE),
  ('row_level_policies:write',  'Sửa phạm vi dữ liệu', 'Thu hẹp hoặc mở rộng phạm vi dữ liệu của một vai trò',         TRUE),
  ('row_level_policies:delete', 'Xoá phạm vi dữ liệu', 'Xoá một chính sách phạm vi dữ liệu',                           TRUE);
