package com.g123.sfems.domain.catalog.acquisitionmethod;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.base.SystemKeyed;
import jakarta.persistence.Column;
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
public class AcquisitionMethod extends CatalogEntity implements SystemKeyed {

    /** Khoá hệ thống (312) — mã chữ cố định nghiệp vụ dựa vào; chỉ đọc, {@code null} với mục thêm sau. */
    @Column(name = "system_key", length = 64, insertable = false, updatable = false)
    private String systemKey;

    @Override
    public String getSystemKey() {
        return systemKey;
    }
}
