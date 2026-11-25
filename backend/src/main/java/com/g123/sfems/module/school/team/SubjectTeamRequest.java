package com.g123.sfems.module.school.team;

import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

/** Payload tạo tổ bộ môn. Mã để trống thì máy chủ cấp theo quy tắc mã của trường (TO01…). */
public record SubjectTeamRequest(
        @Text(value = FieldRule.CODE, label = "Mã tổ")
        String code,
        @NotBlank(message = "Tên tổ là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên tổ")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        IdRef leader,
        List<IdRef> subjects,
        List<IdRef> members) implements SchoolOwnedInput {
}
