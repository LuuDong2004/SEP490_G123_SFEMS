package com.g123.sfems.module.catalog.grade;

import com.g123.sfems.domain.catalog.grade.Grade;
import com.g123.sfems.module.catalog.base.CatalogRepository;

public interface GradeRepository extends CatalogRepository<Grade> {

    /** Chống trùng tên khối trong một cấp học; {@code selfId} = khối đang sửa ({@code -1} khi tạo). */
    boolean existsByEducationLevelIdAndNameIgnoreCaseAndIdNot(Long educationLevelId, String name, Long selfId);
}
