package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import com.g123.sfems.shared.validation.DateRange;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Payload sửa năm học. {@code null} là để nguyên — kể cả hai ngày, nên quy tắc
 * "kết thúc sau bắt đầu" phải kiểm trên giá trị SAU KHI GỘP với bản ghi đã lưu,
 * ở service; {@code @DateRange} ở đây chỉ bắt được khi gửi cả hai ngày.
 */
@DateRange(from = "startDate", to = "endDate", message = "Ngày kết thúc không được trước ngày bắt đầu")
public record SchoolYearPatchRequest(
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
        @DateValue(value = DateRule.ANY, label = "Ngày bắt đầu")
        LocalDate startDate,
        @DateValue(value = DateRule.ANY, label = "Ngày kết thúc")
        LocalDate endDate,
        Boolean current) implements CatalogInput {
}
