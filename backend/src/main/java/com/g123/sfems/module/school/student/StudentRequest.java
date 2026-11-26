package com.g123.sfems.module.school.student;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.g123.sfems.domain.school.student.StudentGender;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * Payload thêm học sinh. {@code code} là mã học sinh, {@code name} là họ và tên; lớp gửi ở khoá {@code class}
 * ({@code {"id": n}}). Trường vắng = trường của tài khoản đang đăng nhập, và phải là trường của lớp.
 */
public record StudentRequest(
        @NotBlank(message = "Vui lòng nhập mã học sinh")
        @Text(value = FieldRule.CODE, label = "Mã học sinh")
        String code,
        @NotBlank(message = "Vui lòng nhập họ và tên")
        @Text(value = FieldRule.PERSON_NAME, label = "Họ và tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        @JsonProperty("class")
        @NotNull(message = "Vui lòng chọn lớp")
        IdRef schoolClass,
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày sinh")
        LocalDate birthDate,
        StudentGender gender) implements SchoolOwnedInput {
}
