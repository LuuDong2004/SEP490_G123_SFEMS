--liquibase formatted sql

--changeset luudong:006-seed-quyen-nghiep-vu
--comment Mã quyền chức năng của MỌI resource trong 42 UC (menu dùng chung cho cả nhóm) và cấp cho 5 vai trò theo ma trận quyền Báo cáo 3 mục 4.4. Mã quyền là {resource}:{read|write|delete|approve|export}; resource trùng tên resource ở frontend và đoạn đường dẫn /api/{resource}. Phạm vi dữ liệu (chỉ trường mình, chỉ cấp duyệt của mình) do server kiểm, không nằm trong mã quyền.

INSERT INTO permissions (code, name, description, system_permission) VALUES
  -- Thông báo (HT-06)
  ('notifications:read',          'Xem thông báo',                 'Xem thông báo của mình',                                             TRUE),
  ('notifications:write',         'Cập nhật thông báo',            'Đánh dấu đã đọc',                                                    TRUE),
  ('notifications:delete',        'Xoá thông báo',                 'Xoá thông báo của mình',                                             TRUE),
  -- Danh mục dùng chung (DM-01)
  ('wards:read',                  'Xem phường/xã',                 'Xem danh mục phường/xã',                                             TRUE),
  ('wards:write',                 'Sửa phường/xã',                 'Thêm, sửa, ngừng dùng phường/xã',                                    TRUE),
  ('wards:delete',                'Xoá phường/xã',                 'Xoá phường/xã chưa dùng',                                            TRUE),
  ('education_levels:read',       'Xem cấp học',                   'Xem danh mục cấp học',                                               TRUE),
  ('education_levels:write',      'Sửa cấp học',                   'Thêm, sửa, ngừng dùng cấp học',                                      TRUE),
  ('education_levels:delete',     'Xoá cấp học',                   'Xoá cấp học chưa dùng',                                              TRUE),
  ('room_types:read',             'Xem loại phòng',                'Xem danh mục loại phòng',                                            TRUE),
  ('room_types:write',            'Sửa loại phòng',                'Thêm, sửa, ngừng dùng loại phòng',                                   TRUE),
  ('room_types:delete',           'Xoá loại phòng',                'Xoá loại phòng chưa dùng',                                           TRUE),
  ('school_years:read',           'Xem năm học',                   'Xem danh mục năm học',                                               TRUE),
  ('school_years:write',          'Sửa năm học',                   'Thêm, sửa, ngừng dùng năm học',                                      TRUE),
  ('school_years:delete',         'Xoá năm học',                   'Xoá năm học chưa dùng',                                              TRUE),
  ('grades:read',                 'Xem khối lớp',                  'Xem danh mục khối lớp',                                              TRUE),
  ('grades:write',                'Sửa khối lớp',                  'Thêm, sửa, ngừng dùng khối lớp',                                     TRUE),
  ('grades:delete',               'Xoá khối lớp',                  'Xoá khối lớp chưa dùng',                                             TRUE),
  ('subjects:read',               'Xem môn học',                   'Xem danh mục môn học',                                               TRUE),
  ('subjects:write',              'Sửa môn học',                   'Thêm, sửa, ngừng dùng môn học',                                      TRUE),
  ('subjects:delete',             'Xoá môn học',                   'Xoá môn học chưa dùng',                                              TRUE),
  ('equipment_types:read',        'Xem loại thiết bị',             'Xem danh mục loại thiết bị',                                         TRUE),
  ('equipment_types:write',       'Sửa loại thiết bị',             'Thêm, sửa, ngừng dùng loại thiết bị',                                TRUE),
  ('equipment_types:delete',      'Xoá loại thiết bị',             'Xoá loại thiết bị chưa dùng',                                        TRUE),
  ('units:read',                  'Xem đơn vị tính',               'Xem danh mục đơn vị tính',                                           TRUE),
  ('units:write',                 'Sửa đơn vị tính',               'Thêm, sửa, ngừng dùng đơn vị tính',                                  TRUE),
  ('units:delete',                'Xoá đơn vị tính',               'Xoá đơn vị tính chưa dùng',                                          TRUE),
  ('origin_sources:read',         'Xem nguồn hình thành',          'Xem danh mục nguồn hình thành',                                      TRUE),
  ('origin_sources:write',        'Sửa nguồn hình thành',          'Thêm, sửa, ngừng dùng nguồn hình thành',                             TRUE),
  ('origin_sources:delete',       'Xoá nguồn hình thành',          'Xoá nguồn hình thành chưa dùng',                                     TRUE),
  ('acquisition_methods:read',    'Xem phương thức hình thành',    'Xem danh mục phương thức hình thành',                                TRUE),
  ('acquisition_methods:write',   'Sửa phương thức hình thành',    'Thêm, sửa, ngừng dùng phương thức hình thành',                       TRUE),
  ('acquisition_methods:delete',  'Xoá phương thức hình thành',    'Xoá phương thức hình thành chưa dùng',                               TRUE),
  ('movement_reasons:read',       'Xem lý do biến động',           'Xem danh mục lý do biến động',                                       TRUE),
  ('movement_reasons:write',      'Sửa lý do biến động',           'Thêm, sửa, ngừng dùng lý do biến động',                              TRUE),
  ('movement_reasons:delete',     'Xoá lý do biến động',           'Xoá lý do biến động chưa dùng',                                      TRUE),
  -- Danh mục thiết bị, danh mục tối thiểu và định mức, quy tắc sinh mã (DM-02, DM-03, DM-04)
  ('equipment_catalogs:read',     'Xem danh mục thiết bị',         'Xem danh mục thiết bị dùng chung',                                   TRUE),
  ('equipment_catalogs:write',    'Sửa danh mục thiết bị',         'Thêm, sửa thiết bị trong danh mục dùng chung',                       TRUE),
  ('equipment_catalogs:delete',   'Xoá danh mục thiết bị',         'Xoá thiết bị chưa dùng khỏi danh mục',                               TRUE),
  ('equipment_standards:read',    'Xem danh mục tối thiểu',        'Xem bộ danh mục thiết bị dạy học tối thiểu',                         TRUE),
  ('equipment_standards:write',   'Sửa danh mục tối thiểu',        'Lập bộ mới, sửa bộ nháp, áp dụng bộ thay bộ đang hiệu lực',          TRUE),
  ('equipment_standards:delete',  'Xoá danh mục tối thiểu',        'Xoá bộ danh mục tối thiểu còn nháp',                                 TRUE),
  ('equipment_norms:read',        'Xem định mức thiết bị',         'Xem các dòng định mức của bộ danh mục tối thiểu',                    TRUE),
  ('equipment_norms:write',       'Sửa định mức thiết bị',         'Thêm, sửa dòng định mức của bộ nháp',                                TRUE),
  ('equipment_norms:delete',      'Xoá định mức thiết bị',         'Xoá dòng định mức của bộ nháp',                                      TRUE),
  ('code_rules:read',             'Xem quy tắc sinh mã',           'Xem tiền tố, độ dài phần số của mã danh mục và mã phòng',           TRUE),
  ('code_rules:write',            'Sửa quy tắc sinh mã',           'Khai, sửa quy tắc sinh mã',                                          TRUE),
  ('code_rules:delete',           'Xoá quy tắc sinh mã',           'Xoá quy tắc sinh mã chưa dùng',                                      TRUE),
  -- Tổ chức và cơ sở vật chất (TC-01, TC-02)
  ('schools:read',                'Xem trường học',                'Xem danh sách và hồ sơ trường',                                      TRUE),
  ('schools:write',               'Sửa trường học',                'Thêm, sửa hồ sơ trường',                                             TRUE),
  ('schools:delete',              'Xoá trường học',                'Xoá trường chưa có dữ liệu',                                         TRUE),
  ('rooms:read',                  'Xem phòng',                     'Xem danh sách phòng của trường',                                     TRUE),
  ('rooms:write',                 'Sửa phòng',                     'Thêm, sửa phòng học, phòng bộ môn, kho',                             TRUE),
  ('rooms:delete',                'Xoá phòng',                     'Xoá phòng chưa có thiết bị',                                         TRUE),
  -- Hồ sơ thiết bị và mã tài sản (TS-01 – TS-07)
  ('equipment:read',              'Xem thiết bị',                  'Xem danh sách, hồ sơ, tra cứu theo mã và lịch sử thiết bị',          TRUE),
  ('equipment:write',             'Sửa thiết bị',                  'Bổ sung hồ sơ, khai số dư đầu kỳ, cấp mã chuẩn',                     TRUE),
  ('equipment:delete',            'Xoá thiết bị',                  'Xoá hồ sơ thiết bị đã ra khỏi sổ',                                   TRUE),
  ('equipment:export',            'Xuất thiết bị',                 'Xuất danh sách thiết bị ra tệp',                                     TRUE),
  ('attachments:read',            'Xem tệp đính kèm',              'Mở tệp đính kèm của hồ sơ, phiếu mình xem được',                     TRUE),
  ('attachments:write',           'Tải tệp đính kèm',              'Đính kèm ảnh, tài liệu vào hồ sơ, phiếu',                            TRUE),
  ('attachments:delete',          'Xoá tệp đính kèm',              'Gỡ tệp đính kèm',                                                    TRUE),
  ('school_code_rules:read',      'Xem bộ đếm mã tài sản',         'Xem bộ đếm mã tài sản của trường',                                   TRUE),
  ('school_code_rules:write',     'Sửa bộ đếm mã tài sản',         'Khai, sửa bộ đếm mã tài sản của trường',                             TRUE),
  ('data_imports:read',           'Xem lô nhập dữ liệu',           'Xem kết quả các lần nhập thiết bị từ tệp',                           TRUE),
  ('data_imports:write',          'Nhập dữ liệu từ tệp',           'Tải tệp theo mẫu và ghi nhận các dòng hợp lệ',                       TRUE),
  -- Nhu cầu và kế hoạch mua sắm (NC-01 – NC-07)
  ('purchase_proposals:read',     'Xem đề xuất mua sắm',           'Xem đề xuất mua sắm và mức đáp ứng định mức',                        TRUE),
  ('purchase_proposals:write',    'Lập đề xuất mua sắm',           'Lập, sửa, trình, huỷ đề xuất; lập phiếu nhập từ đề xuất hoàn tất',   TRUE),
  ('purchase_proposals:delete',   'Xoá đề xuất mua sắm',           'Xoá đề xuất nháp chưa từng trình',                                   TRUE),
  ('purchase_proposals:approve',  'Duyệt đề xuất mua sắm',         'Duyệt, trả lại, từ chối đề xuất ở cấp của mình',                     TRUE),
  ('purchase_proposals:export',   'Xuất đề xuất mua sắm',          'Xuất danh sách, tờ trình đề xuất ra tệp',                            TRUE),
  ('procurement_plans:read',      'Xem kế hoạch mua sắm',          'Xem kế hoạch mua sắm của Sở',                                        TRUE),
  ('procurement_plans:write',     'Lập kế hoạch mua sắm',          'Lập, sửa, chọn đề xuất, trình kế hoạch',                             TRUE),
  ('procurement_plans:delete',    'Xoá kế hoạch mua sắm',          'Xoá kế hoạch nháp chưa từng trình',                                  TRUE),
  ('procurement_plans:approve',   'Duyệt kế hoạch mua sắm',        'Duyệt, trả lại kế hoạch',                                            TRUE),
  ('procurement_plans:export',    'Xuất kế hoạch mua sắm',         'Xuất kế hoạch ra tệp',                                               TRUE),
  -- Nhập thiết bị – ghi tăng tài sản (PN-01 – PN-03)
  ('equipment_intakes:read',      'Xem phiếu nhập',                'Xem phiếu nhập thiết bị',                                            TRUE),
  ('equipment_intakes:write',     'Lập phiếu nhập',                'Lập, sửa, trình, huỷ phiếu nhập',                                    TRUE),
  ('equipment_intakes:delete',    'Xoá phiếu nhập',                'Xoá phiếu nháp chưa từng trình',                                     TRUE),
  ('equipment_intakes:approve',   'Duyệt phiếu nhập',              'Duyệt và ghi tăng tài sản, trả lại, từ chối phiếu nhập',             TRUE),
  ('equipment_intakes:export',    'Xuất phiếu nhập',               'Xuất phiếu nhập ra tệp',                                             TRUE),
  -- Kiểm kê (KK-01 – KK-07)
  ('inventory_campaigns:read',    'Xem đợt kiểm kê',               'Xem đợt kiểm kê và tiến độ các trường',                              TRUE),
  ('inventory_campaigns:write',   'Phát động đợt kiểm kê',         'Phát động, sửa đợt kiểm kê',                                         TRUE),
  ('inventory_campaigns:delete',  'Xoá đợt kiểm kê',               'Xoá đợt kiểm kê chưa có phiếu',                                      TRUE),
  ('inventory_sessions:read',     'Xem phiếu kiểm kê',             'Xem phiếu và biên bản kiểm kê',                                      TRUE),
  ('inventory_sessions:write',    'Lập phiếu kiểm kê',             'Lập phiếu, ghi kết quả kiểm đếm, trình, huỷ',                        TRUE),
  ('inventory_sessions:delete',   'Xoá phiếu kiểm kê',             'Xoá phiếu nháp chưa từng trình',                                     TRUE),
  ('inventory_sessions:approve',  'Duyệt biên bản kiểm kê',        'Duyệt, trả lại, từ chối biên bản kiểm kê',                           TRUE),
  ('inventory_sessions:export',   'Xuất biên bản kiểm kê',         'Xuất biên bản kiểm kê ra tệp theo mẫu',                              TRUE),
  -- Báo cáo (BC-02 – BC-06)
  ('reports:read',                'Xem báo cáo',                   'Xem bốn báo cáo: tài sản, mức đáp ứng, mua sắm, kiểm kê',           TRUE),
  ('reports:export',              'Xuất báo cáo',                  'Xuất báo cáo ra CSV hoặc Excel',                                     TRUE);

-- Quản trị viên: mọi quyền (gồm cả quyền seed ở đây; quyền ở changelog 004 đã cấp trước).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Cả năm vai trò: thông báo của mình; xem danh mục, trường, phòng, thiết bị, đợt kiểm kê; xem và xuất báo cáo.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'notifications:read', 'notifications:write', 'notifications:delete',
  'wards:read', 'education_levels:read', 'room_types:read', 'school_years:read', 'grades:read', 'subjects:read',
  'equipment_types:read', 'units:read', 'origin_sources:read', 'acquisition_methods:read', 'movement_reasons:read',
  'equipment_catalogs:read', 'equipment_standards:read', 'equipment_norms:read', 'code_rules:read',
  'schools:read', 'rooms:read',
  'equipment:read', 'equipment:export', 'attachments:read',
  'purchase_proposals:read', 'purchase_proposals:export',
  'equipment_intakes:read', 'equipment_intakes:export',
  'inventory_campaigns:read', 'inventory_sessions:read', 'inventory_sessions:export',
  'reports:read', 'reports:export')
WHERE r.code IN ('SO_LEADER', 'SO_SPECIALIST', 'SCHOOL_LEADER', 'SCHOOL_STAFF');

-- Lãnh đạo Sở: duyệt đề xuất cấp Sở; xem, duyệt, xuất kế hoạch mua sắm.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'purchase_proposals:approve',
  'procurement_plans:read', 'procurement_plans:approve', 'procurement_plans:export')
WHERE r.code = 'SO_LEADER';

-- Chuyên viên Sở: khai danh mục; thêm sửa trường; lập kế hoạch mua sắm; phát động đợt kiểm kê.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'wards:write', 'wards:delete', 'education_levels:write', 'education_levels:delete',
  'room_types:write', 'room_types:delete', 'school_years:write', 'school_years:delete',
  'grades:write', 'grades:delete', 'subjects:write', 'subjects:delete',
  'equipment_types:write', 'equipment_types:delete', 'units:write', 'units:delete',
  'origin_sources:write', 'origin_sources:delete', 'acquisition_methods:write', 'acquisition_methods:delete',
  'movement_reasons:write', 'movement_reasons:delete',
  'equipment_catalogs:write', 'equipment_catalogs:delete',
  'equipment_standards:write', 'equipment_standards:delete', 'equipment_norms:write', 'equipment_norms:delete',
  'code_rules:write', 'code_rules:delete',
  'schools:write',
  'procurement_plans:read', 'procurement_plans:write', 'procurement_plans:delete', 'procurement_plans:export',
  'inventory_campaigns:write', 'inventory_campaigns:delete')
WHERE r.code = 'SO_SPECIALIST';

-- Lãnh đạo trường: phòng và hồ sơ thiết bị của trường; duyệt đề xuất cấp trường, phiếu nhập, biên bản kiểm kê.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'rooms:write',
  'equipment:write', 'attachments:write',
  'school_code_rules:read',
  'purchase_proposals:approve',
  'equipment_intakes:approve',
  'inventory_sessions:approve')
WHERE r.code = 'SCHOOL_LEADER';

-- Cán bộ thiết bị trường: phòng, hồ sơ thiết bị, nhập từ tệp, bộ đếm mã; lập đề xuất, phiếu nhập, phiếu kiểm kê.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'rooms:write',
  'equipment:write', 'equipment:delete', 'attachments:write', 'attachments:delete',
  'school_code_rules:read', 'school_code_rules:write',
  'data_imports:read', 'data_imports:write',
  'purchase_proposals:write', 'purchase_proposals:delete',
  'equipment_intakes:write', 'equipment_intakes:delete',
  'inventory_sessions:write', 'inventory_sessions:delete')
WHERE r.code = 'SCHOOL_STAFF';
