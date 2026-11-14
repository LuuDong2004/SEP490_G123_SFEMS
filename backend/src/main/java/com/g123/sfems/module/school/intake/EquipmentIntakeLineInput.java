package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Một dòng trên body của phiếu.
 *
 * <p>Các dòng vẫn gửi lên NGUYÊN BỘ và thay danh sách cũ (dòng vắng mặt là dòng bị xoá), nhưng
 * dòng mang {@code id} của một dòng đang có thì được SỬA TẠI CHỖ chứ không tạo lại: tệp hoá đơn
 * gắn theo dòng ({@code equipment_intake_lines}) bám vào id đó.
 */
public record EquipmentIntakeLineInput(
        @NotNull(message = "Chọn nhóm thiết bị")
        IdRef catalog,
        @Text(value = FieldRule.NAME, label = "Tên thiết bị", max = 200, min = 2)
        String name,
        PhysicalDigitalType physicalOrDigital,
        AssetCategory assetCategory,
        @NotNull(message = "Nhập số lượng theo chứng từ")
        @Min(value = 1, message = "Số lượng theo chứng từ tối thiểu là 1")
        @Num(value = NumberRule.QUANTITY, label = "Số lượng theo chứng từ")
        Integer documentQuantity,
        @NotNull(message = "Nhập số lượng thực nhận")
        @Min(value = 0, message = "Số lượng thực nhận không được âm")
        @Num(value = NumberRule.QUANTITY_OR_ZERO, label = "Số lượng thực nhận")
        Integer receivedQuantity,
        @Text(value = FieldRule.NOTE, label = "Lý do nhận khác hoá đơn", max = 255, min = 5)
        String varianceReason,
        @Num(value = NumberRule.UNIT_PRICE, label = "Đơn giá")
        BigDecimal unitPrice,
        IdRef room,
        Map<String, Object> details,
        // Khai riêng của dòng — để trống thì theo đầu phiếu.
        @Text(value = FieldRule.SHORT_TEXT, label = "Nhà cung cấp", max = 200, min = 2)
        String supplier,
        @Text(value = FieldRule.SHORT_TEXT, label = "Số hoá đơn", max = 100)
        String documentNo,
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày hoá đơn")
        LocalDate documentDate,
        FundingSource fundingSource,
        @Text(value = FieldRule.SHORT_TEXT, label = "Ghi rõ nguồn kinh phí", max = 200, min = 5)
        String fundingNote,
        IdRef acquisitionMethod,
        @Text(value = FieldRule.SHORT_TEXT, label = "Ghi rõ hình thức mua sắm", max = 200, min = 5)
        String acquisitionNote,
        @Num(value = NumberRule.COUNT, label = "Bảo hành (tháng)")
        Integer warrantyMonths,
        // Model/hãng của LÔ hàng này — khác nhau giữa các lần mua, nên theo dòng chứ không theo nhóm.
        @Text(value = FieldRule.SHORT_TEXT, label = "Model", max = 50)
        String model,
        @Text(value = FieldRule.SHORT_TEXT, label = "Hãng sản xuất", max = 100)
        String manufacturer,
        @Text(value = FieldRule.NOTE, label = "Thông tin khác")
        String otherInfo,
        // Hạn sử dụng của lô vật tư tiêu hao, hoá chất; dòng thiết bị từng cái bỏ qua.
        @DateValue(value = DateRule.ANY, label = "Hạn sử dụng")
        LocalDate expiryDate,
        // Quy cách bao bì của vật tư, hoá chất (QLTB-501): 1 <packUnit> = <packSize> <đơn vị của thiết bị>.
        IdRef packUnit,
        @DecimalMin(value = "0.001", message = "Lượng trong một bao bì phải lớn hơn 0")
        @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Quy cách")
        BigDecimal packSize,
        // Số serial của từng cái, theo thứ tự cấp cho thiết bị sinh ra lúc duyệt — không bắt buộc, không quá số
        // lượng, không trùng trong trường (service kiểm); mỗi số bỏ khoảng trắng, viết hoa.
        @Size(max = 10000, message = "Quá nhiều số serial")
        List<@Text(value = FieldRule.SERIAL, label = "Số serial", min = 3) String> serialNumbers,
        // Dòng đã có: giữ nguyên id để tệp hoá đơn gắn theo dòng không bị bỏ rơi mỗi lần lưu.
        Long id) {
}
