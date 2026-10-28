package com.g123.sfems.module.security.role.api.dto;

import jakarta.validation.constraints.NotNull;

/**
 * A permission referred to by id in a role payload.
 *
 * <p>Nested rather than a bare id list because the admin UI's multi-select
 * round-trips the objects it was given — the same reason {@code CategoryRef}
 * exists on the blog post side.
 */
public record PermissionRef(@NotNull(message = "Thiếu mã quyền") Long id) {
}
