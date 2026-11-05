package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.voucher.VoucherRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * Body của lập và sửa phiếu nhập (PN-01). Form gửi lại nguyên phiếu mỗi lần lưu, nên tạo và sửa dùng
 * chung một hình.
 */
public record EquipmentIntakeRequest(
        IdRef school,
        @NotNull(message = "Nhập ngày nhập")
        LocalDate intakeDate,
        @Size(max = 100, message = "Số chứng từ tối đa 100 ký tự")
        String documentNo,
        LocalDate documentDate,
        @Size(max = 255, message = "Nhà cung cấp tối đa 255 ký tự")
        String supplier,
        FundingSource fundingSource,
        IdRef originSource,
        @Size(max = 255, message = "Tối đa 255 ký tự")
        String originNote,
        IdRef acquisitionMethod,
        IdRef schoolYear,
        @Min(value = 0, message = "Thời hạn bảo hành không được âm")
        @Max(value = 600, message = "Thời hạn bảo hành tối đa 600 tháng")
        Integer warrantyMonths,
        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note,
        @Size(max = 500, message = "Một phiếu tối đa 500 dòng")
        List<@Valid EquipmentIntakeLineInput> lines) implements VoucherRequest {
}
