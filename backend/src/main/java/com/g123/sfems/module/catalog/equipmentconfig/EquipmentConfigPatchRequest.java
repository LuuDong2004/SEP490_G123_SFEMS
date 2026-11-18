package com.g123.sfems.module.catalog.equipmentconfig;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload sửa bộ thông số. {@code null} là để nguyên; danh sách gửi lên là thay cả danh sách. */
public record EquipmentConfigPatchRequest(
        @Size(min = 1, message = "Mã không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @Size(min = 1, message = "Tên không được để trống")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @Text(value = FieldRule.NOTE, label = "Mô tả")
        String description,
        Boolean defaultConfig,
        List<IdRef> scopeTypes,
        @Text(value = FieldRule.SHORT_TEXT, label = "Số hiệu", max = 100)
        String documentNo,
        @Text(value = FieldRule.SHORT_TEXT, label = "Trích yếu")
        String documentName,
        @DateValue(value = DateRule.ANY, label = "Ngày ban hành")
        LocalDate issueDate,
        IdRef startSchoolYear,
        IdRef endSchoolYear,
        @Valid
        List<ConfigAttributeInput> attributes) implements CatalogInput {
}
