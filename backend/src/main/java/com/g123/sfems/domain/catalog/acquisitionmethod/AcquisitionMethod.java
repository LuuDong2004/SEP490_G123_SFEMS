package com.g123.sfems.domain.catalog.acquisitionmethod;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Phương thức hình thành (DM-01): mua sắm, được cấp, được tài trợ… Phiếu nhập ghi tài sản có được bằng cách nào. */
@Entity
@Table(name = "acquisition_methods")
public class AcquisitionMethod extends CatalogEntity {
}
