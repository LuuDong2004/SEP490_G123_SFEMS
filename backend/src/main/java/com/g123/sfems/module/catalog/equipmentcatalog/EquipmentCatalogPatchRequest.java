package com.g123.sfems.module.catalog.equipmentcatalog;

import java.util.List;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload sửa nhóm thiết bị. {@code null} là để nguyên. */
public record EquipmentCatalogPatchRequest(
        @Size(min = 1, message = "Mã DM thiết bị không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã DM thiết bị", max = 64)
        String code,
        @Size(min = 1, message = "Tên không được để trống")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @Pattern(regexp = "^$|^[A-Z]{3}$", message = "Mã loại chuẩn gồm đúng 3 chữ in hoa")
        String teachingCode,
        IdRef parent,
        IdRef equipmentType,
        IdRef subject,
        IdRef educationLevel,
        IdRef grade,
        IdRef unit,
        @Text(value = FieldRule.SHORT_TEXT, label = "Model")
        String model,
        @Text(value = FieldRule.SHORT_TEXT, label = "Hãng sản xuất")
        String manufacturer,
        TrackingType trackingType,
        AssetCategory assetCategory,
        PhysicalDigitalType physicalOrDigital,
        @Text(value = FieldRule.CODE, label = "Mã thống kê", max = 64)
        String statisticalCode,
        @Text(value = FieldRule.SHORT_TEXT, label = "Căn cứ pháp lý")
        String legalBasis,
        @Text(value = FieldRule.LONG_TEXT, label = "Mô tả chi tiết", max = 20000)
        String description,
        Boolean usedByTeacher,
        Boolean usedByStudent,
        Boolean selfMade,
        Boolean minimumRequired,
        /**
         * Chọn NHIỀU: mục đầu là cái CHÍNH (ghi vào cột chính), các mục sau là thêm. Có danh sách thì nó thay
         * cho trường đơn cùng nghĩa; vắng ({@code null}) thì trường đơn vẫn dùng như trước.
         */
        List<IdRef> educationLevels,
        List<IdRef> subjects,
        List<IdRef> grades) implements CatalogInput {
}
