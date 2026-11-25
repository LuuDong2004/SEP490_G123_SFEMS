package com.g123.sfems.domain.catalog.enums;

/**
 * Một giá trị của danh mục CỐ ĐỊNH — danh mục mà logic nghiệp vụ rẽ nhánh theo
 * từng giá trị (nhóm tài sản quyết định cách hạch toán, chức vụ quyết định
 * quyền duyệt...), nên nằm trong code chứ không để người dùng thêm/xoá.
 *
 * <p>{@link #code()} là mã lưu trong database — giữ đúng mã của bản Jmix để dữ
 * liệu chuyển sang không phải đổi. {@link #label()} là nhãn tiếng Việt, lấy từ
 * gói i18n của bản Jmix.
 */
public interface LabeledEnum {

    String code();

    String label();
}
