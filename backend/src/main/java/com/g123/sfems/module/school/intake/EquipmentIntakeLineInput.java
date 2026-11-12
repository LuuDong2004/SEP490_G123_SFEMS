package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Một dòng trên body của phiếu nhập. Các dòng gửi lên NGUYÊN BỘ và thay danh sách cũ: dòng vắng mặt
 * là dòng bị xoá. Các trường khai riêng (nhà cung cấp, chứng từ, nguồn kinh phí...) để trống thì theo
 * đầu phiếu.
 */
public record EquipmentIntakeLineInput(
        @NotNull(message = "Chọn nhóm thiết bị")
        IdRef catalog,
        @Size(max = 255, message = "Tên thiết bị tối đa 255 ký tự")
        String name,
        PhysicalDigitalType physicalOrDigital,
        AssetCategory assetCategory,
        @NotNull(message = "Nhập số lượng theo chứng từ")
        @Min(value = 1, message = "Số lượng theo chứng từ tối thiểu là 1")
        @Max(value = 100000, message = "Số lượng theo chứng từ tối đa 100.000")
        Integer documentQuantity,
        @NotNull(message = "Nhập số lượng thực nhận")
        @Min(value = 0, message = "Số lượng thực nhận không được âm")
        @Max(value = 100000, message = "Số lượng thực nhận tối đa 100.000")
        Integer receivedQuantity,
        @Size(max = 255, message = "Lý do chênh lệch tối đa 255 ký tự")
        String varianceReason,
        @DecimalMin(value = "0", message = "Đơn giá không được âm")
        BigDecimal unitPrice,
        IdRef room,
        @Size(max = 255, message = "Nhà cung cấp tối đa 255 ký tự")
        String supplier,
        @Size(max = 100, message = "Số hoá đơn tối đa 100 ký tự")
        String documentNo,
        LocalDate documentDate,
        FundingSource fundingSource,
        @Size(max = 255, message = "Tối đa 255 ký tự")
        String fundingNote,
        IdRef acquisitionMethod,
        @Size(max = 255, message = "Tối đa 255 ký tự")
        String acquisitionNote,
        @Min(value = 0, message = "Thời hạn bảo hành không được âm")
        @Max(value = 600, message = "Thời hạn bảo hành tối đa 600 tháng")
        Integer warrantyMonths,
        @Size(max = 255, message = "Model tối đa 255 ký tự")
        String model,
        @Size(max = 255, message = "Hãng sản xuất tối đa 255 ký tự")
        String manufacturer,
        @Size(max = 255, message = "Ghi chú tối đa 255 ký tự")
        String note,
        IdRef movementReason,
        /** Id của dòng đang có (sửa phiếu); vắng là dòng mới. Giữ id để tệp hoá đơn gắn theo dòng còn bám vào. */
        Long id,
        /** Hạn sử dụng của lô vật tư, hoá chất. */
        LocalDate expiryDate,
        /** Quy cách bao bì: đơn vị bao bì và lượng đơn vị của thiết bị trong một bao bì. */
        IdRef packUnit,
        @DecimalMin(value = "0.001", message = "Lượng trong một bao bì phải lớn hơn 0")
        BigDecimal packSize) {
}
