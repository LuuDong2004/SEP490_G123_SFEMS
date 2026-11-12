package com.g123.sfems.module.organization.school.api.dto;

/**
 * Đối tượng {@code schoolType} trên body của request trường học. Ba trạng thái như
 * {@link EducationLevelRef}: vắng mặt để nguyên, {@code {"id": null}} xoá, {@code {"id": n}} gán.
 */
public record SchoolTypeRef(Long id) {
}
