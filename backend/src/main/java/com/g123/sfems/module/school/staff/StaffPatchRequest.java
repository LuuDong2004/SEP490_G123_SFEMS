package com.g123.sfems.module.school.staff;

import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.school.staff.StaffType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Payload sửa cán bộ. {@code null} là để nguyên. */
public record StaffPatchRequest(
        @Size(min = 1, message = "Mã cán bộ không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã cán bộ", max = 20)
        String code,
        @Size(min = 1, message = "Họ tên không được để trống")
        @Size(min = 2, message = "Họ tên tối thiểu 2 ký tự")
        @Text(value = FieldRule.PERSON_NAME, label = "Họ tên", max = 50)
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        StaffType staffType,
        StaffPosition position,
        @Text(value = FieldRule.SHORT_TEXT, label = "Phòng ban")
        String department,
        @Text(value = FieldRule.PHONE, label = "Số điện thoại")
        String phone,
        @Text(value = FieldRule.EMAIL, label = "Email")
        String email,
        List<IdRef> subjects,
        IdRef mainSubject) implements SchoolOwnedInput {
}
