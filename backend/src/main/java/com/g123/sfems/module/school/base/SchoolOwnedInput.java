package com.g123.sfems.module.school.base;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;

/** Payload của dữ liệu thuộc trường: năm trường chung + trường sở hữu (tuỳ chọn). */
public interface SchoolOwnedInput extends CatalogInput {

    IdRef school();
}
