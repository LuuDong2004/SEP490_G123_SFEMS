package com.g123.sfems.domain.catalog.ward;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Phường/Xã của TP.HCM theo cấu trúc hành chính từ 2025: KHÔNG còn cấp
 * quận/huyện, địa chỉ chỉ còn phường/xã. Mã là mã đơn vị hành chính của Tổng
 * cục Thống kê, nên nó ổn định giữa các lần nạp dữ liệu.
 */
@Entity
@Table(name = "wards")
public class Ward extends CatalogEntity {
}
