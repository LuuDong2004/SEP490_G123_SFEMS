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
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Payload sửa học sinh, ngữ nghĩa patch cho mã, họ tên, lớp, cờ hoạt động, ghi chú: vắng là để nguyên. Đổi
 * {@code class} là chuyển lớp — sĩ số cả hai lớp đếm lại.
 *
 * <p>Ngày sinh và giới tính thì THAY HẲN: hộp sửa luôn gửi đủ hai ô, và ô để trống phải xoá được giá trị cũ — với
 * patch, "vắng" và "xoá" là cùng một {@code null}.
 */
public record StudentPatchRequest(
        @Size(min = 1, message = "Mã học sinh không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã học sinh")
        String code,
        @Size(min = 1, message = "Họ và tên không được để trống")
        @Text(value = FieldRule.PERSON_NAME, label = "Họ và tên", min = 2)
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        @JsonProperty("class")
        IdRef schoolClass,
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày sinh")
        LocalDate birthDate,
        StudentGender gender) implements SchoolOwnedInput {
}
