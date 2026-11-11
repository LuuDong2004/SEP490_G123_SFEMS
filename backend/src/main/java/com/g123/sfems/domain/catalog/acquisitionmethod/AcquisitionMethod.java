package com.g123.sfems.domain.catalog.acquisitionmethod;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Hình thức mua sắm (DM-01): mua sắm tập trung, đấu thầu, chỉ định thầu, mua trực tiếp… Chỉ khai khi
 * nguồn hình thành là Mua sắm; tài sản về trường bằng cách nào là nguồn hình thành.
 */
@Entity
@Table(name = "acquisition_methods")
public class AcquisitionMethod extends CatalogEntity {
}
