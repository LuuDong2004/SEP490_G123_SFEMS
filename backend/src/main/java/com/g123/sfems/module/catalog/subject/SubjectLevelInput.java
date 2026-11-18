package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.domain.catalog.subject.SubjectType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;

/**
 * Một dòng "môn này dạy ở cấp học nào, bắt buộc hay tự chọn" trên body request.
 *
 * <p>{@code educationLevel} là đối tượng lồng {@code {"id": n}} như mọi tham
 * chiếu khác, để màn sửa gửi lại nguyên bản ghi nó đã nhận.
 */
public record SubjectLevelInput(
        @NotNull(message = "Cấp học là bắt buộc")
        @Valid
        IdRef educationLevel,
        SubjectType subjectType,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder) {
}
