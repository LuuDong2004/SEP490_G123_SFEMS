package com.g123.sfems.module.security.permission.api.dto;

import com.g123.sfems.domain.security.permission.Permission;

/** Wire shape of a permission. */
public record PermissionResponse(
        Long id, String code, String name, String description, boolean systemPermission) {

    public static PermissionResponse from(Permission permission) {
        return new PermissionResponse(
                permission.getId(),
                permission.getCode(),
                permission.getName(),
                permission.getDescription(),
                permission.isSystemPermission());
    }
}
