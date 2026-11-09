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

/**
 * Trường thêm một thiết bị NGOÀI danh mục của Sở. Không có mã (hệ thống cấp) và không có trường (lấy
 * từ tài khoản đăng nhập). Bắt buộc đúng những nhãn mà báo cáo của Sở cộng theo — loại, đơn vị tính,
 * phân loại tài sản, nguồn gốc — để thiết bị này được tính đủ dù không có trong danh mục. Môn học để
 * trống là "dùng chung".
 */
public record SchoolItemRequest(
        @NotBlank(message = "Tên là bắt buộc")
        @Size(max = 255, message = "Tên tối đa 255 ký tự")
        String name,

        @NotNull(message = "Chọn loại thiết bị")
        IdRef equipmentType,

        IdRef subject,

        /**
         * Các môn dùng thiết bị này, theo thứ tự chọn: môn ĐẦU là môn chính, các môn sau là môn thêm. Có
         * danh sách này thì {@code subject} bị bỏ qua; rỗng hoặc vắng cả hai là thiết bị dùng chung.
         */
        @Size(max = 6, message = "Chọn tối đa 6 môn")
        List<IdRef> subjects,

        @NotNull(message = "Chọn đơn vị tính")
        IdRef unit,

        @NotNull(message = "Chọn phân loại tài sản")
        AssetCategory assetCategory,

        TrackingType trackingType,

        PhysicalDigitalType physicalOrDigital,

        @NotNull(message = "Chọn nguồn gốc")
        CatalogOrigin origin,

        @Size(max = 255, message = "Model tối đa 255 ký tự")
        String model,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note) {
}
