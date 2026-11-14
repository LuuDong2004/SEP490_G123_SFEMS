package com.g123.sfems.module.school.intake;

import com.g123.sfems.module.school.voucher.VoucherLimits;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Payload tạo phiếu nhập. Phiếu mới luôn là NHÁP — không có trường
 * {@code status}: chuyển trạng thái là một hành động có endpoint riêng, không
 * phải một giá trị gửi kèm form.
 *
 * <p>Số phiếu cũng không có mặt: nó do hệ thống cấp lúc xác nhận.
 */
public record EquipmentIntakeRequest(
        IdRef school,
        @NotNull(message = "Nhập ngày nhập")
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày nhập")
        LocalDate intakeDate,
        // Số hoá đơn khi mua sắm (1–30, chữ không dấu, số, / - .) kiểm ở service — nguồn khác ghi số quyết định, biên bản.
        @Text(value = FieldRule.SHORT_TEXT, label = "Số chứng từ", max = 100)
        String documentNo,
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày chứng từ")
        LocalDate documentDate,
        @Text(value = FieldRule.SHORT_TEXT, label = "Nhà cung cấp", max = 200, min = 2)
        String supplier,
        FundingSource fundingSource,
        IdRef originSource,
        @Text(value = FieldRule.SHORT_TEXT, label = "Ghi rõ nguồn hình thành", max = 200, min = 5)
        String originNote,
        // Năm học của lần ghi tăng; để trống thì lấy năm học chứa ngày nhập.
        IdRef schoolYear,
        IdRef acquisitionMethod,
        @Min(value = 0, message = "Thời hạn bảo hành không được âm")
        @Max(value = 600, message = "Thời hạn bảo hành tối đa 600 tháng")
        Integer warrantyMonths,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @Size(max = VoucherLimits.MAX_LINES, message = VoucherLimits.TOO_MANY_LINES) List<@Valid EquipmentIntakeLineInput> lines,
        Map<String, Object> details) {
}
