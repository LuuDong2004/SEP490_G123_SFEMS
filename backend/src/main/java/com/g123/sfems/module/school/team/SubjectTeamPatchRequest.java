package com.g123.sfems.module.school.team;

import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Payload sửa tổ bộ môn, ngữ nghĩa patch: vắng là để nguyên. Tổ trưởng xoá được bằng
 * {@code {"id": null}}; {@code subjects} / {@code members} gửi lên là danh sách ĐẦY ĐỦ mới.
 */
public record SubjectTeamPatchRequest(
        @Size(min = 1, message = "Mã tổ không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã tổ")
        String code,
        @Size(min = 1, message = "Tên tổ không được để trống")
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
