package com.g123.sfems.domain.catalog.semester;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Học kỳ (DM-01): Học kỳ 1, Học kỳ 2, Cả năm. Danh mục lựa chọn, chỉ có năm trường chung. */
@Entity
@Table(name = "semesters")
public class Semester extends CatalogEntity {
}
