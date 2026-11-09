package com.g123.sfems.domain.catalog.enums;

/**
 * Một giá trị của danh mục cố định: nghiệp vụ rẽ nhánh theo từng giá trị (loại tài sản quyết định cách
 * hạch toán, nguồn hình thành quyết định nguồn kinh phí…) nên giá trị nằm trong code, người dùng không
 * thêm, xoá được. {@link #code()} là mã hiển thị, {@link #label()} là nhãn tiếng Việt.
 */
public interface LabeledEnum {

    String code();

    String label();
}
