package com.g123.sfems.domain.catalog.unit;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Đơn vị tính (DM-01): cái, bộ, chiếc, hộp… Chỉ có năm trường chung. */
@Entity
@Table(name = "units")
public class Unit extends CatalogEntity {
}
