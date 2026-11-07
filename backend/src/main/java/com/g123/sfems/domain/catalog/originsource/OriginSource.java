package com.g123.sfems.domain.catalog.originsource;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Nguồn hình thành (DM-01): tài sản về trường bằng cách nào — mua sắm, được Sở phân bổ, được tặng,
 * kiểm kê thừa, tự làm, khác. Danh mục cố định sáu dòng; luật của từng dòng ở {@link OriginRule}.
 * Tiền lấy từ đâu là nguồn kinh phí, không phải danh mục này.
 */
@Entity
@Table(name = "origin_sources")
public class OriginSource extends CatalogEntity {
}
