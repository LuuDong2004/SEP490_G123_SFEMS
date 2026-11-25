package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Payload sửa một dòng danh mục tối thiểu. {@code null} là để nguyên; chữ rỗng ở các trường chữ
 * là xoá. {@code minQuantity} không xoá được qua đây — muốn "không tính tự động" thì xoá nguyên văn
 * số lượng và căn cứ (dòng phụ lục không ghi số vốn là trường hợp hiếm, do bộ nạp đặt).
 */
public record EquipmentNormPatchRequest(
        @Size(min = 1, message = "Mã không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @Size(min = 1, message = "Tên không được để trống")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
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
        IdRef sourceDocument,
        /** Văn bản căn cứ của lần sửa — bắt buộc với bộ đang áp dụng. */
        IdRef legalDocument,
        /** Điều chỉnh của dòng (changelog 276) — vắng là để nguyên (sửa) / không được phép (thêm). */
        @Valid NormAdjustmentRequest adjustment) implements CatalogInput {
}
