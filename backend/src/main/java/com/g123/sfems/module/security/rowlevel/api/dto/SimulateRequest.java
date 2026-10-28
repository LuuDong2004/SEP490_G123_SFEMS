package com.g123.sfems.module.security.rowlevel.api.dto;

import jakarta.validation.constraints.NotNull;

/** "Would this account be allowed to do this to that row?" */
public record SimulateRequest(
        @NotNull(message = "Chọn chức năng áp dụng") String resource,
        @NotNull(message = "Chọn thao tác") String action,
        @NotNull(message = "Chọn tài khoản") Long userId,
        @NotNull(message = "Chọn bản ghi") Long recordId) {
}
