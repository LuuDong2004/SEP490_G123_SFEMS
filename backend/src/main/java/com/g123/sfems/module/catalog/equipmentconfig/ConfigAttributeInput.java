package com.g123.sfems.module.catalog.equipmentconfig;

import com.g123.sfems.domain.catalog.equipmentconfig.AttributeDataType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Một thông số trong payload của bộ. {@code id} có giá trị là sửa thông số cũ;
 * vắng là thêm mới; thông số không có trong danh sách gửi lên bị xoá.
 */
public record ConfigAttributeInput(
        Long id,
        @NotBlank(message = "Nhập mã thông số")
        @Text(value = FieldRule.CODE, label = "Mã thông số", max = 64)
        @Pattern(regexp = "^[A-Za-z0-9_]+$", message = "Mã chỉ gồm chữ không dấu, số và gạch dưới")
        String code,
        @NotBlank(message = "Nhập tên thông số")
        @Text(value = FieldRule.NAME, label = "Tên thông số")
        String name,
        AttributeDataType dataType,
        @Text(value = FieldRule.SHORT_TEXT, label = "Đơn vị đo", max = 32)
        String measureUnit,
        Boolean required,
        List<@Text(value = FieldRule.SHORT_TEXT, label = "Lựa chọn") String> options) {
}
