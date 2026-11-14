package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload sửa bộ tiêu chuẩn. {@code null} là để nguyên; {@code documents} gửi lên là thay cả danh sách. */
public record EquipmentStandardPatchRequest(
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
        IdRef educationLevel,
        IdRef startSchoolYear,
        IdRef endSchoolYear,
        @Text(value = FieldRule.SHORT_TEXT, label = "Phiên bản", max = 50)
        String standardVersion,
        IdRef previousStandard,
        @Valid
        List<StandardDocumentInput> documents) implements CatalogInput {
}
