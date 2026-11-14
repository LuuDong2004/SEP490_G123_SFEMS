package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import com.g123.sfems.shared.validation.DateRange;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload tạo năm học: năm trường chung + khoảng ngày + cờ hiện hành. */
@DateRange(from = "startDate", to = "endDate", message = "Ngày kết thúc không được trước ngày bắt đầu")
public record SchoolYearRequest(
        // Để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã (QLTB-178); danh mục không có quy tắc thì báo thiếu.
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @NotNull(message = "Ngày bắt đầu là bắt buộc")
        @DateValue(value = DateRule.ANY, label = "Ngày bắt đầu")
        LocalDate startDate,
        @NotNull(message = "Ngày kết thúc là bắt buộc")
        @DateValue(value = DateRule.ANY, label = "Ngày kết thúc")
        LocalDate endDate,
        Boolean current) implements CatalogInput {
}
