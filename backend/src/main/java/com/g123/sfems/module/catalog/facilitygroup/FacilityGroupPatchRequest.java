package com.g123.sfems.module.catalog.facilitygroup;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Payload sửa khối CSVC: {@code null} là để nguyên; {@code levels} rỗng là mọi cấp. */
public record FacilityGroupPatchRequest(
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
        List<String> levels) implements CatalogInput {
}
