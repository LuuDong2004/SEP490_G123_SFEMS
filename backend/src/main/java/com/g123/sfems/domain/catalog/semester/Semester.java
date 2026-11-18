package com.g123.sfems.domain.catalog.semester;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Học kỳ — danh mục dùng chung, toàn cục cho mọi trường.
 *
 * <p>Toàn bộ hình dạng nằm ở {@link CatalogEntity}; lớp này chỉ gắn tên bảng.
 * Không mang {@code @RowLevelResource}: không cột nào nói bản ghi thuộc về ai.
 */
@Entity
@Table(name = "semesters")
public class Semester extends CatalogEntity {
}
