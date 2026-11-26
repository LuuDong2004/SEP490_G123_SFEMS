package com.g123.sfems.module.catalog.originsource;

import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.module.catalog.base.CatalogRepository;

/** Mọi phương thức đến từ {@link CatalogRepository}. */
public interface OriginSourceRepository extends CatalogRepository<OriginSource> {

    /** Dòng của một luật — khoá hệ thống (314) là tên luật. */
    java.util.Optional<OriginSource> findBySystemKey(String systemKey);
}
