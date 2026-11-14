package com.g123.sfems.domain.catalog.originsource;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Nguồn hình thành — danh mục dùng chung, toàn cục cho mọi trường.
 *
 * <p>Toàn bộ hình dạng nằm ở {@link CatalogEntity}; lớp này chỉ gắn tên bảng.
 * Không mang {@code @RowLevelResource}: không cột nào nói bản ghi thuộc về ai.
 */
@Entity
@Table(name = "origin_sources")
public class OriginSource extends CatalogEntity {
}
