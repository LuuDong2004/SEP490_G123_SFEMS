package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.CatalogOrigin;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Trường thêm một thiết bị NGOÀI danh mục của Sở. Không có mã (hệ thống cấp) và không có trường
 * (lấy từ tài khoản đăng nhập). Bắt buộc đúng những nhãn mà báo cáo của Sở cộng theo — loại, đơn
 * vị tính, phân loại tài sản, nguồn gốc — để thiết bị này được tính đủ dù không có trong danh mục.
 * Môn học để trống là "dùng chung".
 */
public record SchoolItemRequest(
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @NotNull(message = "Chọn loại thiết bị")
        IdRef equipmentType,
        IdRef subject,
        /**
         * Các môn dùng thiết bị này, theo thứ tự chọn: môn ĐẦU là môn chính (quyết định mã dạy học
         * trong mã tài sản), các môn sau là môn thêm. Có danh sách này thì {@code subject} bị bỏ qua;
         * rỗng / vắng cả hai = thiết bị dùng chung.
         */
        @Size(max = 6, message = "Chọn tối đa 6 môn")
        List<IdRef> subjects,
        @NotNull(message = "Chọn đơn vị tính")
        IdRef unit,
        @NotNull(message = "Chọn phân loại kế toán")
        AssetCategory assetCategory,
        TrackingType trackingType,
        PhysicalDigitalType physicalOrDigital,
        @NotNull(message = "Chọn nguồn gốc")
        CatalogOrigin origin,
        @Text(value = FieldRule.SHORT_TEXT, label = "Model")
        String model,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note) {
}
