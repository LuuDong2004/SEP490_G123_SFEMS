package com.g123.sfems.module.organization.school.api.dto;

import com.g123.sfems.domain.organization.DepartmentSource;
import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một trường học. */
public record SchoolResponse(
        Long id,
        String code,
        String shortCode,
        String moetCode,
        String name,
        DepartmentSummary departmentOfEducation,
        /**
         * Cơ quan quản lý được xác định bằng cách nào. CHỈ ĐỌC — không có ô
         * nào trên form ghi vào đây; nó nói về xuất xứ của dữ liệu, không phải
         * một thuộc tính của trường.
         */
        DepartmentSource departmentSource,
        EducationLevelSummary educationLevel,
        WardSummary ward,
        String wardText,
        String district,
        String address,
        String primaryColor,
        Integer classCount,
        Integer studentCount,
        OrgStatus status,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /**
     * Cơ quan quản lý, rút gọn.
     *
     * <p>Khai ngay trong feature này chứ không import
     * {@code DepartmentOfEducationResponse}: một feature không dùng {@code
     * api/dto} của feature khác, kể cả khi hình dạng hôm nay giống hệt. Nhờ
     * vậy nới rộng payload của endpoint Sở không lặng lẽ nới rộng payload của
     * endpoint trường.
     */
    public record DepartmentSummary(Long id, String code, String name) {
    }

    /**
     * Phường/xã, rút gọn. Cùng lý do như trên.
     *
     * <p>Đi kèm {@code wardText} ở mức trên: dòng chưa ghép được với danh mục
     * thì {@code ward} rỗng còn {@code wardText} giữ chữ người dùng đã gõ, nên
     * màn hình nói được "chưa chuẩn hoá" thay vì hiển thị ô trống.
     */
    public record WardSummary(Long id, String code, String name) {
    }

    /** Cấp học, rút gọn. Cùng lý do như trên. */
    public record EducationLevelSummary(Long id, String code, String name, String shortName) {
    }

    /** Không kèm cờ dòng — dùng cho tiếng vọng của bản ghi vừa xoá. */
    public static SchoolResponse from(School school) {
        return from(school, null);
    }

    public static SchoolResponse from(School school, RowLevelSecurity rowLevel) {
        var department = school.getDepartmentOfEducation();
        var level = school.getEducationLevel();
        var ward = school.getWard();
        return new SchoolResponse(
                school.getId(),
                school.getCode(),
                school.getShortCode(),
                school.getMoetCode(),
                school.getName(),
                department == null
                        ? null
                        : new DepartmentSummary(
                                department.getId(), department.getCode(), department.getName()),
                school.getDepartmentSource(),
                level == null
                        ? null
                        : new EducationLevelSummary(
                                level.getId(), level.getCode(), level.getName(), level.getShortName()),
                ward == null ? null : new WardSummary(ward.getId(), ward.getCode(), ward.getName()),
                school.getWardText(),
                school.getDistrict(),
                school.getAddress(),
                school.getPrimaryColor(),
                school.getClassCount(),
                school.getStudentCount(),
                school.getStatus(),
                school.getCreatedAt(),
                school.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(school));
    }
}
