package com.g123.sfems.module.security.user.api.dto;

/**
 * Tham chiếu tới cơ quan quản lý khi tạo hoặc sửa tài khoản.
 *
 * <p>Ba trạng thái, cùng lý do như {@link SchoolRef}: vắng mặt là để nguyên,
 * {@code {"id": null}} là gỡ khỏi cơ quan đang thuộc, {@code {"id": n}} là
 * gán. Jackson báo cáo một đối tượng vắng mặt và một {@code null} tường minh
 * giống hệt nhau, nên phân biệt phải nằm ở lớp bọc này chứ không ở mức trường.
 */
public record ManagingBodyRef(Long id) {
}
