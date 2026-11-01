package com.g123.sfems.domain.catalog.equipmenttype;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Loại thiết bị (DM-01): thiết bị dạy học, máy móc, đồ dùng, vật tư… Chỉ có năm trường chung. */
@Entity
@Table(name = "equipment_types")
public class EquipmentType extends CatalogEntity {
}
