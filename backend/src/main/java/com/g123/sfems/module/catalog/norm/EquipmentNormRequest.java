package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Payload tạo một dòng danh mục tối thiểu. Mã để trống thì máy chủ cấp ({@code DM-<cấp>-NNNN});
 * thiết bị chọn rồi thì loại, môn, đơn vị để trống lấy theo thiết bị.
 */
public record EquipmentNormRequest(
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @NotNull(message = "Chọn bộ tiêu chuẩn")
        IdRef standard,
        IdRef catalog,
        IdRef equipmentType,
        IdRef subject,
        IdRef grade,
        IdRef roomType,
        @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Số lượng")
        BigDecimal minQuantity,
        IdRef unit,
        NormBasis normBasis,
        @Min(value = 1, message = "Cỡ nhóm tối thiểu là 1")
        @Num(value = NumberRule.COUNT, label = "Cỡ nhóm")
        Integer basisSize,
        @Text(value = FieldRule.SHORT_TEXT, label = "Số lượng (nguyên văn)", max = 100)
        String quantityText,
        @Text(value = FieldRule.SHORT_TEXT, label = "Đơn vị (nguyên văn)", max = 50)
        String unitText,
        @Text(value = FieldRule.SHORT_TEXT, label = "Lớp áp dụng", max = 40)
        @Pattern(regexp = "^$|^[0-9]{1,2}(,[0-9]{1,2})*$", message = "Lớp áp dụng dạng 6,7,8")
        String gradeLevels,
        @Text(value = FieldRule.SHORT_TEXT, label = "Số thứ tự", max = 20)
        String itemNo,
        @Text(value = FieldRule.NOTE, label = "Nhóm")
        String sectionName,
        @Text(value = FieldRule.NOTE, label = "Chủ đề")
        String topic,
        @Text(value = FieldRule.LONG_TEXT, label = "Mục đích", max = 20000)
        String purpose,
        @Text(value = FieldRule.LONG_TEXT, label = "Mô tả chi tiết", max = 20000)
        String description,
        Boolean forTeacher,
        Boolean forStudent,
        Boolean optional,
        IdRef sourceDocument) implements CatalogInput {

    EquipmentNormRequest withSortOrder(Integer order) {
        return new EquipmentNormRequest(code, name, order, active, note, standard, catalog,
                equipmentType, subject, grade, roomType, minQuantity, unit, normBasis, basisSize, quantityText,
                unitText, gradeLevels, itemNo, sectionName, topic, purpose, description, forTeacher, forStudent,
                optional, sourceDocument);
    }

    EquipmentNormRequest withCode(String generated) {
        return new EquipmentNormRequest(generated, name, sortOrder, active, note, standard, catalog,
                equipmentType, subject, grade, roomType, minQuantity, unit, normBasis, basisSize, quantityText,
                unitText, gradeLevels, itemNo, sectionName, topic, purpose, description, forTeacher, forStudent,
                optional, sourceDocument);
    }
}
