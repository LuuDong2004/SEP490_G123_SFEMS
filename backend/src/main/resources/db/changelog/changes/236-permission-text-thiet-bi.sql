--liquibase formatted sql

--changeset qltb:236-permission-text-thiet-bi
-- Chữ trên màn hình bỏ hẳn "tài sản", dùng "thiết bị" (quyết định của trưởng nhóm). Trong dữ liệu hệ thống chỉ còn
-- mô tả của hai quyền mang chữ này. Nội dung danh mục / định mức theo thông tư ("tôn trọng tài sản của người khác")
-- là bài học, không phải nhãn — giữ nguyên.
UPDATE permissions SET description = 'Lập, sửa phiếu nháp và xác nhận nhận hàng (ghi tăng thiết bị)'
 WHERE code = 'equipment_intakes:write' AND description = 'Lập, sửa phiếu nháp và xác nhận nhận hàng (ghi tăng tài sản)';
UPDATE permissions SET description = 'Nhập hồ sơ thiết bị, cán bộ từ tệp Excel / CSV'
 WHERE code = 'data_transfer:write' AND description = 'Nhập hồ sơ tài sản, cán bộ từ tệp Excel / CSV';
--rollback UPDATE permissions SET description = 'Lập, sửa phiếu nháp và xác nhận nhận hàng (ghi tăng tài sản)' WHERE code = 'equipment_intakes:write' AND description = 'Lập, sửa phiếu nháp và xác nhận nhận hàng (ghi tăng thiết bị)';
--rollback UPDATE permissions SET description = 'Nhập hồ sơ tài sản, cán bộ từ tệp Excel / CSV' WHERE code = 'data_transfer:write' AND description = 'Nhập hồ sơ thiết bị, cán bộ từ tệp Excel / CSV';
