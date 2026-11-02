package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.base.CatalogRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SchoolYearRepository extends CatalogRepository<SchoolYear> {

    /**
     * Bỏ cờ hiện hành của mọi năm học khác {@code keepId} ({@code null} khi đang tạo mới). Chạy TRƯỚC
     * khi đặt cờ cho năm học mới, để unique index "chỉ một năm hiện hành" không bị vấp.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("UPDATE SchoolYear y SET y.current = false WHERE y.current = true AND (:keepId IS NULL OR y.id <> :keepId)")
    void clearCurrentExcept(@Param("keepId") Long keepId);
}
