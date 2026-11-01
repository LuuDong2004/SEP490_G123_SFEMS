package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import java.util.Optional;

public interface SubjectRepository extends CatalogRepository<Subject> {

    /** Môn đang giữ mã môn này, trên toàn bảng — để kiểm trùng trước khi lưu. */
    Optional<Subject> findByShortCodeIgnoreCase(String shortCode);
}
