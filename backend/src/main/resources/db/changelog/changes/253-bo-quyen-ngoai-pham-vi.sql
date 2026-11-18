--liquibase formatted sql

--changeset luudong:253-bo-quyen-ngoai-pham-vi
--comment Bỏ mã quyền và phạm vi dòng của các chức năng ngoài phạm vi đồ án (danh sách UC, sheet "bị bỏ"): cấp phát, điều chuyển, mượn trả, báo hỏng / sửa chữa / bảo hành / bảo trì, thanh lý, hao mòn, tiêu hao, kho, minh chứng, điều chỉnh chuẩn, công trình CSVC, khoá API đối tác, kết nối hệ thống ngoài. Bảng dữ liệu của các chức năng đó để nguyên (không còn code đọc / ghi). role_permissions và row_level_policy xoá theo khoá ngoại CASCADE.
DELETE FROM row_level_policy
WHERE resource IN ('equipment_allocations', 'equipment_transfers', 'equipment_loans', 'room_bookings',
                   'consumption_records', 'damage_reports', 'depreciation_orders', 'disposals', 'maintenance_orders',
                   'maintenance_plans', 'repair_orders', 'warranty_claims', 'stock_issues', 'storage_orders',
                   'equipment_stock', 'facility_works');

DELETE FROM permissions
WHERE split_part(code, ':', 1) IN ('equipment_allocations', 'equipment_transfers', 'equipment_loans', 'room_bookings',
                                   'consumption_records', 'damage_reports', 'depreciation_orders', 'disposals',
                                   'maintenance_orders', 'maintenance_plans', 'repair_orders', 'warranty_claims',
                                   'stock_issues', 'storage_orders', 'equipment_stock', 'evidence',
                                   'standard_adjustments', 'standard_adjustment_rules', 'facility_works',
                                   'api_clients', 'integrations');
