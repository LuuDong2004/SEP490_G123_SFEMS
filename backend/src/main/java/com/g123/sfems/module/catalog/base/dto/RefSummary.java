package com.g123.sfems.module.catalog.base.dto;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.base.SystemKeyed;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;

/**
 * Một mục danh mục rút gọn — id, mã, tên — để trả kèm bản ghi trỏ tới nó.
 * Đủ cho ô chọn ghép giá trị hiện tại và cho cột bảng.
 */
public record RefSummary(Long id, String code, String name, String systemKey) {

    public RefSummary(Long id, String code, String name) {
        this(id, code, name, null);
    }

    /** Kèm khoá hệ thống (312) với danh mục có khoá — màn so khoá ({@code KHO}, {@code TAP_TRUNG}…), không so mã. */
    public static RefSummary of(CatalogEntity item) {
        return item == null ? null : new RefSummary(item.getId(), item.getCode(), item.getName(),
                item instanceof SystemKeyed keyed ? keyed.getSystemKey() : null);
    }

    /** Cấp học là danh mục viết riêng, không kế thừa {@link CatalogEntity}. */
    public static RefSummary of(EducationLevel level) {
        return level == null ? null : new RefSummary(level.getId(), level.getCode(), level.getName());
    }
}
