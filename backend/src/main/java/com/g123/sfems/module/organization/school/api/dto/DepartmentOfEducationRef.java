package com.g123.sfems.module.organization.school.api.dto;


/**
 * Đối tượng {@code departmentOfEducation} trên body của request trường học.
 *
 * <p>Ô chọn của form ghi vào {@code departmentOfEducation.id}, và ở màn sửa
 * thì bản ghi nạp lên vẫn mang theo mã và tên của Sở, nên payload đến dưới
 * dạng cả một đối tượng. Chỉ {@code id} được đọc; thuộc tính khác bị bỏ qua
 * (Spring Boot tắt sẵn {@code FAIL_ON_UNKNOWN_PROPERTIES}).
 *
 * <p>{@code id} bắt buộc khác {@code null}: cột {@code NOT NULL}, một trường
 * luôn phải thuộc về một Sở, nên "xoá" không phải trạng thái hợp lệ.
 */
public record DepartmentOfEducationRef(
        /** Rỗng = Sở mặc định (TP.HCM) khi tạo; để nguyên khi sửa. */
        Long id) {
}
