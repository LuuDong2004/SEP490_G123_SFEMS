package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.DocumentRole;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Một văn bản căn cứ trong payload của bộ tiêu chuẩn. {@code id} có giá trị là
 * sửa văn bản đã có — giữ được liên kết từ các dòng định mức trỏ vào nó; vắng
 * là thêm mới. Văn bản không có trong danh sách gửi lên bị xoá.
 */
public record StandardDocumentInput(
        Long id,
        DocumentRole documentRole,
        @NotBlank(message = "Nhập số hiệu văn bản")
        @Text(value = FieldRule.SHORT_TEXT, label = "Số hiệu", max = 50, min = 3)
        String documentNo,
        @Text(value = FieldRule.NOTE, label = "Trích yếu", min = 10)
        String documentName,
        @Text(value = FieldRule.NAME, label = "Cơ quan ban hành", max = 200, min = 2)
        String issuingAuthority,
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày ban hành")
        LocalDate issueDate,
        @DateValue(value = DateRule.ANY, label = "Ngày hiệu lực")
        LocalDate effectiveDate,
        @Text(value = FieldRule.URL, label = "Đường dẫn", max = 1000)
        String url) {
}
