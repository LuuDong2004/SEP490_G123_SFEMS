package com.g123.sfems.domain.catalog.originsource;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Nguồn hình thành (DM-01): ngân sách nhà nước, xã hội hoá, tài trợ… Phiếu nhập ghi nguồn kinh phí theo danh mục này. */
@Entity
@Table(name = "origin_sources")
public class OriginSource extends CatalogEntity {
}
