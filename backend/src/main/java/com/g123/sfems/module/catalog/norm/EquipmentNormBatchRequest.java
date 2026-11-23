package com.g123.sfems.module.catalog.norm;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code PATCH /api/equipment_norms/batch} — sửa nhiều dòng một lần (màn Ma trận định mức: đổi "tính
 * theo" cho cả trăm dòng). Mỗi mục là id + đúng payload sửa một dòng.
 */
public record EquipmentNormBatchRequest(
        @NotEmpty(message = "Chưa có dòng nào để lưu")
        @Size(max = 1000, message = "Mỗi lần lưu tối đa 1000 dòng")
        List<@Valid @NotNull Item> items) {

    public record Item(
            @NotNull(message = "Thiếu id dòng") Long id,
            @Valid @NotNull(message = "Thiếu nội dung sửa") EquipmentNormPatchRequest changes) {
    }
}
