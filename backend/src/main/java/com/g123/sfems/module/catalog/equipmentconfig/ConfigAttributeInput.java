package com.g123.sfems.module.catalog.equipmentconfig;

import com.g123.sfems.domain.catalog.equipmentconfig.AttributeDataType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Một thông số trong payload của bộ. {@code id} có giá trị là sửa thông số cũ; vắng là thêm mới; thông
 * số không có trong danh sách gửi lên bị xoá.
 */
public record ConfigAttributeInput(
        Long id,

        @NotBlank(message = "Nhập mã thông số")
        @Size(max = 64, message = "Mã thông số tối đa 64 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9_]+$", message = "Mã chỉ gồm chữ không dấu, số và gạch dưới")
        String code,

        @NotBlank(message = "Nhập tên thông số")
        @Size(max = 255, message = "Tên thông số tối đa 255 ký tự")
        String name,

        AttributeDataType dataType,

        @Size(max = 32, message = "Đơn vị đo tối đa 32 ký tự")
        String measureUnit,

        Boolean required,

        List<@Size(max = 255, message = "Lựa chọn tối đa 255 ký tự") String> options) {
}
