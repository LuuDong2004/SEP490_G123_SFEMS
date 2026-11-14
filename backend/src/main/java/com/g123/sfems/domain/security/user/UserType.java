package com.g123.sfems.domain.security.user;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;

/**
 * Loại tài khoản — ba khung làm việc của hệ thống: Quản trị · Sở · Trường (đồ án không có cấp UBND). Cũng là loại của vai ({@code roles.role_type}):
 * tài khoản chỉ mang vai cùng loại. Cố định từ lúc tạo: đổi loại là tạo tài khoản
 * mới. Lưu ở {@code users.user_type}, là cột phân loại của kế thừa {@link User}; ràng buộc CHECK ở CSDL bảo đảm
 * {@code SCHOOL} có trường, {@code SO} có cơ quan quản lý, {@code SYSTEM} không gắn đơn vị nào.
 */
public enum UserType {
    /** Quản trị hệ thống — không gắn đơn vị, không thấy dữ liệu nghiệp vụ. */
    SYSTEM("Quản trị hệ thống"),
    /** Lãnh đạo, chuyên viên Sở GD&ĐT. */
    SO("Sở GD&ĐT"),
    /** Lãnh đạo trường, cán bộ thiết bị. */
    SCHOOL("Trường học");

    private final String label;

    UserType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** Loại suy từ đơn vị công tác: có trường → SCHOOL; có cơ quan quản lý (Sở) → SO; không gì → SYSTEM. */
    public static UserType of(School school, DepartmentOfEducation managingBody) {
        if (school != null) {
            return SCHOOL;
        }
        if (managingBody != null) {
            return SO;
        }
        return SYSTEM;
    }
}
