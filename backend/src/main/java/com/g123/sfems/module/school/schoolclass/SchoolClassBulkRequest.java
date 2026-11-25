package com.g123.sfems.module.school.schoolclass;

import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * "Thêm nhanh" như MISA: một khối, N lớp, tên lớp ghép từ tiền tố và số thứ tự — khối 6, tiền tố
 * "6A", từ 1, 4 lớp → 6A1, 6A2, 6A3, 6A4; hoặc theo chữ ({@code letters}): tiền tố "6", từ 1,
 * 3 lớp → 6A, 6B, 6C. Lớp đã có trong năm học thì bỏ qua, không báo lỗi.
 */
public record SchoolClassBulkRequest(
        IdRef school,
        @NotNull(message = "Chọn khối lớp")
        IdRef grade,
        @NotNull(message = "Chọn năm học")
        IdRef schoolYear,
        @NotBlank(message = "Nhập tiền tố tên lớp")
        @Text(value = FieldRule.SHORT_TEXT, label = "Tiền tố", max = 20)
        @Pattern(regexp = "^[\\p{L}\\p{N}._-][\\p{L}\\p{N}._ /-]*$", message = "Tiền tố chỉ gồm chữ, số, khoảng trắng, dấu chấm, gạch dưới và gạch nối")
        String prefix,
        @NotNull(message = "Nhập số bắt đầu")
        @Min(value = 0, message = "Số bắt đầu không được âm")
        @Max(value = 999, message = "Số bắt đầu tối đa 999")
        Integer start,
        @NotNull(message = "Nhập số lớp")
        @Min(value = 1, message = "Ít nhất 1 lớp")
        @Max(value = 30, message = "Tối đa 30 lớp một lần")
        Integer count,
        @Num(value = NumberRule.COUNT, label = "Sĩ số")
        @Max(value = 200, message = "Sĩ số tối đa 200")
        Integer studentCount,
        /** {@code true}: hậu tố là CHỮ (6A, 6B, 6C — số thứ tự 1 = A); vắng / {@code false}: là số (6A1, 6A2). */
        Boolean letters) {
}
