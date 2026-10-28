package com.g123.sfems.module.organization.departmentofeducation.api.dto;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một Sở/Phòng GD. */
public record DepartmentOfEducationResponse(
        Long id,
        String code,
        String name,
        String province,
        String address,
        ManagingBodyType type,
        OrgStatus status,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /** Không kèm cờ dòng — dùng cho tiếng vọng của bản ghi vừa xoá. */
    public static DepartmentOfEducationResponse from(DepartmentOfEducation department) {
        return from(department, null);
    }

    public static DepartmentOfEducationResponse from(
            DepartmentOfEducation department, RowLevelSecurity rowLevel) {
        return new DepartmentOfEducationResponse(
                department.getId(),
                department.getCode(),
                department.getName(),
                department.getProvince(),
                department.getAddress(),
                department.getType(),
                department.getStatus(),
                department.getCreatedAt(),
                department.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(department));
    }
}
