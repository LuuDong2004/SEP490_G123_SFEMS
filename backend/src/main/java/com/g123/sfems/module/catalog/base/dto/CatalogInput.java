package com.g123.sfems.module.catalog.base.dto;

import jakarta.validation.constraints.PositiveOrZero;

/**
 * Năm trường chung mà mọi payload tạo/sửa danh mục đều mang.
 *
 * <p>Record không kế thừa được, nên một danh mục có trường riêng (khối lớp trỏ
 * tới cấp học, năm học có ngày bắt đầu...) khai record của riêng nó và cài
 * interface này. {@code CatalogService} xử lý năm trường chung qua interface,
 * rồi giao phần còn lại cho lớp con — nhờ vậy kiểm trùng mã, sắp xếp mặc định,
 * trim chuỗi và luồng kiểm phân quyền vẫn nằm ở MỘT chỗ.
 */
public interface CatalogInput {

    String code();

    String name();

    @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder();

    Boolean active();

    String note();
}
