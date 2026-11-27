package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import java.time.LocalDate;

/**
 * Một hoá đơn (chứng từ) của phiếu ghi tăng (254). Gửi NGUYÊN BỘ cùng các dòng; dòng chỉ tới hoá đơn của nó bằng vị
 * trí trong danh sách ({@link EquipmentIntakeLineInput#documentIndex()}). Hoá đơn mang {@code id} của hoá đơn đang có
 * thì được sửa tại chỗ — tệp hoá đơn gắn theo id đó.
 */
public record EquipmentIntakeDocumentInput(
        Long id,
        @Text(value = FieldRule.NAME, label = "Nhà cung cấp", max = 200, min = 2)
        String supplier,
        @Text(value = FieldRule.TAX_CODE, label = "Mã số thuế")
        String taxCode,
        // Số hoá đơn khi mua sắm (1–30, chữ không dấu, số, / - .) kiểm ở service — nguồn khác ghi số quyết định, biên bản.
        @Text(value = FieldRule.SHORT_TEXT, label = "Số chứng từ", max = 100)
        String documentNo,
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày chứng từ")
        LocalDate documentDate,
        FundingSource fundingSource,
        @Text(value = FieldRule.SHORT_TEXT, label = "Ghi rõ nguồn kinh phí", max = 200, min = 5)
        String fundingNote,
        IdRef acquisitionMethod,
        @Text(value = FieldRule.SHORT_TEXT, label = "Ghi rõ hình thức mua sắm", max = 200, min = 5)
        String acquisitionNote,
        // Số điện thoại HOẶC email — kiểm ở service (`EquipmentIntakeService.contactProblem`), một luật ô không nói được "hoặc".
        String contact) {
}
