package com.g123.sfems.domain.catalog.originsource;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.base.SystemKeyed;
import jakarta.persistence.Column;
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
public class OriginSource extends CatalogEntity implements SystemKeyed {

    /** Khoá hệ thống (314) = tên luật {@link OriginRule} (MUA_SAM, PHAN_BO…); mã hiển thị là NG001…, chỉ đọc. */
    @Column(name = "system_key", length = 64, insertable = false, updatable = false)
    private String systemKey;

    @Override
    public String getSystemKey() {
        return systemKey;
    }

    /** Chỉ cho đối tượng dựng trong bộ nhớ (test luật) — cột không ghi được qua JPA. */
    public void setSystemKey(String systemKey) {
        this.systemKey = systemKey;
    }
}
