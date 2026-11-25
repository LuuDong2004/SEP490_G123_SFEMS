package com.g123.sfems.module.catalog.facilitygroup;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

/** Payload tạo khối CSVC: năm trường chung + cấp áp dụng (rỗng là mọi cấp). */
public record FacilityGroupRequest(
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        List<String> levels) implements CatalogInput {
}
