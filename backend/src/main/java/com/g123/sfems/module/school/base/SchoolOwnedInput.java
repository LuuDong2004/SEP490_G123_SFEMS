package com.g123.sfems.module.school.base;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;

/** Payload của dữ liệu thuộc trường: năm trường chung của danh mục + trường sở hữu (tuỳ chọn). */
public interface SchoolOwnedInput extends CatalogInput {

    /** Vắng thì lấy trường của tài khoản đang đăng nhập. */
    IdRef school();
}
