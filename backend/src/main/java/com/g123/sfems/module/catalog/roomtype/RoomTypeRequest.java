package com.g123.sfems.module.catalog.roomtype;

import java.util.Map;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

/**
 * Payload tạo loại CSVC (Sở): năm trường chung + khối, phòng hay khu vực, cấp áp dụng, chuẩn / ngoài danh mục, văn
 * bản, cờ cho mượn, cờ phòng bộ môn. {@code roomGroup}, {@code educationLevel} là trường cũ, còn nhận cho client cũ.
 */
public record RoomTypeRequest(
        // Để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã (QLTB-178); danh mục không có quy tắc thì báo thiếu.
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @Text(value = FieldRule.SHORT_TEXT, label = "Nhóm phòng", max = 64)
        String roomGroup,
        IdRef educationLevel,
        IdRef group,
        String kind,
        List<String> levels,
        Boolean standard,
        @Text(value = FieldRule.SHORT_TEXT, label = "Văn bản căn cứ")
        String legalBasis,
        Boolean loanable,
        Boolean functional,
        /** Thông số riêng của loại: [{key, label, unit, type}], type = number | text. */
        List<Map<String, String>> params) implements CatalogInput {
}
