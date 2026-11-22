package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.AdjustKind;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import java.math.BigDecimal;
import java.util.List;

/**
 * Điều chỉnh của một dòng danh mục tối thiểu (changelog 276). Gửi kèm là THAY cả khối điều chỉnh; vắng (trong
 * {@link EquipmentNormPatchRequest}) là để nguyên. Ô nào bắt buộc tuỳ kiểu — kiểm ở {@link NormAdjustments#check}.
 */
public record NormAdjustmentRequest(
        AdjustKind kind,
        @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Còn")
        BigDecimal quantity,
        NormBasis basis,
        @Num(value = NumberRule.COUNT, label = "Mỗi")
        Integer basisSize,
        @Text(value = FieldRule.NOTE, label = "Khi")
        String condition,
        IdRef substituteCatalog,
        @Text(value = FieldRule.NOTE, label = "Hình thức thay thế")
        String substituteText,
        Boolean substituteRequired,
        @Text(value = FieldRule.NAME, label = "Nhóm")
        String group,
        @Num(value = NumberRule.COUNT, label = "Được chọn")
        Integer groupPick,
        @Text(value = FieldRule.LONG_TEXT, label = "Câu căn cứ trong thông tư", max = 1000)
        String basisText,
        List<IdRef> shared) {
}
