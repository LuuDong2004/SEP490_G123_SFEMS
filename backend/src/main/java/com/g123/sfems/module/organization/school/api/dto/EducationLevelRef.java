package com.g123.sfems.module.organization.school.api.dto;

/**
 * Đối tượng {@code educationLevel} trên body của request trường học.
 *
 * <p>{@code id} CHO PHÉP {@code null}, và đó là cả lý do record này tồn tại.
 * Cấp học là tham chiếu tuỳ chọn nên nó cần BA trạng thái — để nguyên, gán,
 * xoá — mà Jackson báo cáo một trường vắng mặt và một trường {@code null}
 * tường minh giống hệt nhau. Bọc thêm một lớp thì ba trạng thái trở lại phân
 * biệt được:
 *
 * <ul>
 *   <li>không có khoá {@code educationLevel} → để nguyên</li>
 *   <li>{@code "educationLevel": {"id": null}} → xoá</li>
 *   <li>{@code "educationLevel": {"id": 3}} → gán</li>
 * </ul>
 *
 * <p>Cùng cách mà {@code OrganizationRef}/{@code DepartmentRef} trong feature
 * user giải quyết chuyện "chỗ làm việc phải xoá được".
 */
public record EducationLevelRef(Long id) {
}
