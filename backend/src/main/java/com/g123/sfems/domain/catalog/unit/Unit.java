package com.g123.sfems.domain.catalog.unit;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import java.math.BigDecimal;

/**
 * Đơn vị tính — danh mục dùng chung, toàn cục cho mọi trường.
 *
 * <p>Hình dạng chung nằm ở {@link CatalogEntity}; riêng đơn vị tính có cờ CHO PHÉP SỐ LẺ —
 * kg, g, lít, ml, mét chia được, cái / chiếc / bộ / bình thì không (không có 0,5 cái máy tính).
 * Không mang {@code @RowLevelResource}: không cột nào nói bản ghi thuộc về ai.
 */
@Entity
@Table(name = "units")
public class Unit extends CatalogEntity {

    @Column(name = "allows_fraction", nullable = false)
    private boolean allowsFraction;

    public boolean isAllowsFraction() {
        return allowsFraction;
    }

    public void setAllowsFraction(boolean allowsFraction) {
        this.allowsFraction = allowsFraction;
    }

    /** Số lượng này có hợp với đơn vị không: số lẻ chỉ được khi đơn vị chia được. */
    public static boolean accepts(Unit unit, BigDecimal quantity) {
        if (quantity == null || quantity.stripTrailingZeros().scale() <= 0) {
            return true;
        }
        return unit != null && unit.isAllowsFraction();
    }
}
