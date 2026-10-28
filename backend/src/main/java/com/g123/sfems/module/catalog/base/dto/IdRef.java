package com.g123.sfems.module.catalog.base.dto;

/**
 * Một tham chiếu tới bản ghi khác trên body của request danh mục, dạng
 * {@code {"id": 3}}.
 *
 * <p>{@code id} cho phép {@code null}, và đó là cả lý do phải bọc: một tham
 * chiếu tuỳ chọn cần BA trạng thái mà Jackson không phân biệt được nếu để id
 * trần —
 *
 * <ul>
 *   <li>không có khoá → để nguyên</li>
 *   <li>{@code {"id": null}} → xoá tham chiếu</li>
 *   <li>{@code {"id": 3}} → gán</li>
 * </ul>
 *
 * <p>Ở màn sửa, form gửi lại nguyên đối tượng mà API trả về (kèm mã, tên...).
 * Chỉ {@code id} được đọc; Spring Boot tắt sẵn {@code FAIL_ON_UNKNOWN_PROPERTIES}
 * nên phần thừa bị bỏ qua.
 */
public record IdRef(Long id) {
}
