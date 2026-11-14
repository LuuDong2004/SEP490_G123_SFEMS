package com.g123.sfems.module.school.facility;

import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;

/** Payload tạo cơ sở. */
public record CampusRequest(
        // Để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã (QLTB-178); danh mục không có quy tắc thì báo thiếu.
        @Text(value = FieldRule.CODE, label = "Mã cơ sở")
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên cơ sở")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        Boolean primaryCampus,
        @Text(value = FieldRule.PHONE, label = "Số điện thoại")
        String phone,
        @Text(value = FieldRule.ADDRESS, label = "Địa chỉ")
        String address,
        /** Không phải trường chính: phân hiệu (true) hay điểm trường (false). */
        Boolean branch) implements SchoolOwnedInput {
}
