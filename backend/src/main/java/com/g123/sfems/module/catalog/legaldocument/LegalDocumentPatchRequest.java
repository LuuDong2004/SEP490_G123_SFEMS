package com.g123.sfems.module.catalog.legaldocument;

import com.g123.sfems.domain.catalog.legaldocument.LegalDocumentType;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Payload sửa văn bản quy định. {@code null} là để nguyên; {@code effectiveTo} luôn được ghi (form gửi đủ). */
public record LegalDocumentPatchRequest(
        @Size(min = 1, message = "Số hiệu không được để trống")
        @Text(value = FieldRule.SHORT_TEXT, label = "Số hiệu", max = 50)
        @Pattern(regexp = LegalDocumentService.NUMBER_PATTERN, message = LegalDocumentService.NUMBER_MESSAGE)
        String code,
        @Size(min = 1, message = "Tên văn bản không được để trống")
        @Text(value = FieldRule.NAME, label = "Tên văn bản")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        LegalDocumentType docType,
        @Size(min = 1, message = "Cơ quan ban hành không được để trống")
        @Text(value = FieldRule.NAME, label = "Cơ quan ban hành")
        String issuer,
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày ban hành")
        LocalDate issuedOn,
        @DateValue(value = DateRule.ANY, label = "Ngày có hiệu lực")
        LocalDate effectiveFrom,
        @DateValue(value = DateRule.ANY, label = "Hết hiệu lực")
        LocalDate effectiveTo,
        IdRef replaces) implements CatalogInput {
}
