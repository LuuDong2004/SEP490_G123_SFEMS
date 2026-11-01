package com.g123.sfems.domain.catalog.subjectgroup;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Tổ chuyên môn (DM-01): Tổ Toán – Tin, Tổ Khoa học tự nhiên… Chỉ có năm trường chung. */
@Entity
@Table(name = "subject_groups")
public class SubjectGroup extends CatalogEntity {
}
