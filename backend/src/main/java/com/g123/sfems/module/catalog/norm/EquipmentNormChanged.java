package com.g123.sfems.module.catalog.norm;

/**
 * Một dòng danh mục tối thiểu vừa đổi (sửa), ngừng áp dụng hoặc sắp bị xoá — phát trong giao dịch của lần ghi. Nơi nghe
 * (điều chỉnh của trường, docs/du-lieu-theo-nam-hoc.md §8 bước 9) cho điều chỉnh trên dòng đó hết hiệu lực.
 *
 * @param always {@code true} khi dòng ngừng / bị xoá: hết hiệu lực dù dấu của dòng có đổi hay không
 */
public record EquipmentNormChanged(Long normId, String reason, boolean always) {
}
