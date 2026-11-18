package com.g123.sfems.module.catalog.legaldocument;

import com.g123.sfems.domain.catalog.legaldocument.LegalDocumentType;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.DateRange;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.LocalDate;

/** Payload thêm văn bản quy định: số hiệu ({@code code}), tên văn bản — trích yếu ({@code name}) + phần riêng. */
@DateRange(from = "effectiveFrom", to = "effectiveTo", message = "Hết hiệu lực phải sau ngày có hiệu lực")
public record LegalDocumentRequest(
        @NotBlank(message = "Số hiệu là bắt buộc")
        @Text(value = FieldRule.SHORT_TEXT, label = "Số hiệu", max = 50)
        @Pattern(regexp = LegalDocumentService.NUMBER_PATTERN, message = LegalDocumentService.NUMBER_MESSAGE)
        String code,
        @NotBlank(message = "Tên văn bản là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên văn bản")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @NotNull(message = "Loại văn bản là bắt buộc")
        LegalDocumentType docType,
        @NotBlank(message = "Cơ quan ban hành là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Cơ quan ban hành")
        String issuer,
        @NotNull(message = "Ngày ban hành là bắt buộc")
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày ban hành")
        LocalDate issuedOn,
        @NotNull(message = "Ngày có hiệu lực là bắt buộc")
        @DateValue(value = DateRule.ANY, label = "Ngày có hiệu lực")
        LocalDate effectiveFrom,
        @DateValue(value = DateRule.ANY, label = "Hết hiệu lực")
        LocalDate effectiveTo,
        IdRef replaces) implements CatalogInput {
}
