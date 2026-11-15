package com.g123.sfems.module.catalog.standard;

/**
 * Một dòng phụ lục khác bộ trước. {@code kind}: {@code ADDED} (bộ này mới có), {@code CHANGED} (cùng thiết bị, khác nội
 * dung — {@code fields} kể các phần đổi), {@code REMOVED} (bộ trước có, bộ này bỏ). {@code before} / {@code after}: phần
 * số lượng ("1 × lớp · lớp 1, 2").
 */
public record StandardChange(
        String kind,
        Long subjectId,
        String subjectName,
        Long normId,
        String name,
        String topic,
        String fields,
        String before,
        String after) {
}
