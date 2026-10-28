package com.g123.sfems.module.catalog.coderule;

import java.util.Set;

/**
 * Các danh mục được gắn quy tắc sinh mã. Tên là tên resource — cũng là tên
 * bảng của danh mục, xem {@code CatalogService#codeTarget()}.
 *
 * <p>Khai tường minh thay vì suy từ các bean: phường/xã mang mã hành chính của
 * Nhà nước và không được sinh mã, và chính {@code code_rules} cũng không.
 */
public final class CodeTargets {

    public static final Set<String> ALL = Set.of(
            "education_levels",
            "room_types",
            "school_years",
            "semesters",
            "grades",
            "subject_groups",
            "subjects",
            "equipment_types",
            "units",
            "origin_sources",
            "acquisition_methods",
            "movement_reasons",
            "equipment_standards",
            "equipment_norms",
            "equipment_catalogs",
            "equipment_configs",
            // Mã trường — tự cấp khi Sở thêm trường (093).
            "schools");

    private CodeTargets() {
    }
}
