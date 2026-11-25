package com.g123.sfems.domain.catalog.acquisitionmethod;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Hình thức mua sắm — danh mục dùng chung, toàn cục cho mọi trường.
 *
 * <p>Toàn bộ hình dạng nằm ở {@link CatalogEntity}; lớp này chỉ gắn tên bảng.
 * Không mang {@code @RowLevelResource}: không cột nào nói bản ghi thuộc về ai.
 */
@Entity
@Table(name = "acquisition_methods")
public class AcquisitionMethod extends CatalogEntity {
}
