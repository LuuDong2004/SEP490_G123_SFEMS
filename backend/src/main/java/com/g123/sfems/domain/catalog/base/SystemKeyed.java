package com.g123.sfems.domain.catalog.base;

/**
 * Danh mục có KHOÁ HỆ THỐNG (312): mã chữ cố định mà nghiệp vụ dựa vào (loại CSVC {@code KHO}, {@code THU_VIEN},
 * {@code NHA_AN}…; hình thức mua sắm {@code TAP_TRUNG}, {@code KHAC}…), tách khỏi mã hiển thị — mã hiển thị theo quy
 * tắc sinh mã (LPH001…) và khoá khi sửa. Chỉ các mục có sẵn từ đầu có khoá; mục Sở thêm sau thì {@code null}.
 * Không API nào ghi được cột này.
 */
public interface SystemKeyed {

    String getSystemKey();
}
