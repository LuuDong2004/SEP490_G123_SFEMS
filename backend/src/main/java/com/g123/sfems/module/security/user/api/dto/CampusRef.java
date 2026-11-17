package com.g123.sfems.module.security.user.api.dto;

/**
 * Phạm vi cơ sở trên body của request tài khoản trường — ba trạng thái như {@link SchoolRef}: vắng khoá → để nguyên;
 * {@code {"id": null}} → cả trường; {@code {"id": 3}} → chỉ cơ sở 3.
 */
public record CampusRef(Long id) {
}
