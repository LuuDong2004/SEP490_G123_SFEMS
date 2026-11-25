package com.g123.sfems.module.organization.school.api.dto;

import java.math.BigDecimal;
import jakarta.validation.constraints.DecimalMin;
import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload của {@code PATCH /schools/{id}}.
 *
 * <p>Trường {@code null} nghĩa là "để nguyên"; chuỗi rỗng ở các trường văn bản
 * tuỳ chọn thì XOÁ giá trị.
 *
 * <p>{@code educationLevelId} cần ba trạng thái chứ không phải hai — để
 * nguyên, gán, và XOÁ — mà Jackson báo cáo một trường vắng mặt và một trường
 * {@code null} tường minh giống hệt nhau. Nên nó là một đối tượng bọc có id
 * cho phép null, đúng cách {@code OrganizationRef} trong feature user giải
 * quyết chuyện tương tự: vắng mặt là để nguyên, {@code {"id": null}} là xoá,
 * {@code {"id": n}} là gán.
 *
 * <p>{@code departmentOfEducation} KHÔNG cần ba trạng thái: cột đó
 * {@code NOT NULL}, một trường luôn phải thuộc về một Sở, nên "xoá" không phải
 * một trạng thái hợp lệ — {@code DepartmentOfEducationRef} bắt {@code id} khác
 * null.
 */
public record SchoolPatchRequest(
        @Size(min = 1, message = "Mã trường là bắt buộc")
        @Text(value = FieldRule.CODE, label = "Mã trường")
        String code,

        @Size(min = 1, message = "Tên trường là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên trường")
        String name,

        @Valid
        DepartmentOfEducationRef departmentOfEducation,

        EducationLevelRef educationLevel,

        @Pattern(
                regexp = "^$|^[A-Za-z0-9]{2}$",
                message = "Mã hai ký tự của trường phải đúng 2 ký tự chữ hoặc số")
        String shortCode,

        /** Mã định danh cơ sở giáo dục của Bộ GD&ĐT, 20 ký tự. */
        @Text(value = FieldRule.CODE, label = "Mã định danh Bộ GD&ĐT", max = 20)
        String moetCode,

        // Tham chiếu tới phường/xã, không phải chữ: @Size trên một record không có bộ kiểm nào và làm
        // MỌI lần tạo / sửa trường đổ 500 (HV000030) — từ hồi ô này còn là chuỗi tên phường.
        WardRef ward,

        @Text(value = FieldRule.ADDRESS, label = "Địa chỉ")
        String address,

        @Pattern(
                regexp = "^$|^#[0-9A-Fa-f]{6}$",
                message = "Màu chủ đạo phải có dạng #RRGGBB")
        String primaryColor,

        @DecimalMin(value = "0", message = "Diện tích đất không được âm")
        BigDecimal landArea,

        @DecimalMin(value = "0", message = "Diện tích xây dựng không được âm")
        BigDecimal constructionArea,

        OrgStatus status) {
}
