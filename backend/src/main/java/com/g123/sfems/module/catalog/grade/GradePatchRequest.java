package com.g123.sfems.module.catalog.grade;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload sửa khối lớp: năm trường chung + teachingCode + tham chiếu cấp học. */
public record GradePatchRequest(
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
        // Mã khối theo chương trình (1–12): đi vào mã tài sản, chữ ở đây là gõ nhầm.
        @Pattern(regexp = "^$|^\\d{1,2}$", message = "Mã khối dạy học gồm 1–2 chữ số, vd. 10")
        String teachingCode,
        IdRef educationLevel) implements CatalogInput {
}
