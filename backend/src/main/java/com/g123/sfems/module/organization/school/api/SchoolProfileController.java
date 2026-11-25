package com.g123.sfems.module.organization.school.api;

import com.g123.sfems.module.organization.school.api.dto.SchoolResponse;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.Permissions;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/school_profile} — trường tự sửa phần hồ sơ của CHÍNH MÌNH (mã quyền {@code school_profile:write}, 239):
 * địa chỉ, mã định danh Bộ GD&ĐT; ảnh trường đi qua tệp đính kèm ({@code SchoolAttachmentAccess}). Trường lấy từ người
 * gọi, không nhận từ request — cùng lối với {@code school_users}. Các ô còn lại của hồ sơ trường vẫn chỉ UBND / Sở sửa
 * qua {@code /api/schools}.
 */
@RestController
@RequestMapping("/api/school_profile")
public class SchoolProfileController {

    private final SchoolService schools;
    private final RowLevelPrincipalResolver principals;
    private final RowLevelSecurity rowLevel;

    public SchoolProfileController(
            SchoolService schools, RowLevelPrincipalResolver principals, RowLevelSecurity rowLevel) {
        this.schools = schools;
        this.principals = principals;
        this.rowLevel = rowLevel;
    }

    /** Ô vắng (null) là để nguyên, chuỗi rỗng là xoá. */
    public record ProfileRequest(
            @Text(value = FieldRule.ADDRESS, label = "Địa chỉ")
            String address,

            /** Mã định danh cơ sở giáo dục của Bộ GD&ĐT, 20 ký tự — cùng luật với {@code SchoolPatchRequest}. */
            @Text(value = FieldRule.CODE, label = "Mã định danh Bộ GD&ĐT", max = 20)
            String moetCode) {
    }

    @PatchMapping
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOL_PROFILE_WRITE + "')")
    public SchoolResponse update(@Valid @RequestBody ProfileRequest request) {
        Long schoolId = principals.current()
                .map(RowLevelPrincipal::schoolId)
                .orElseThrow(() -> new AccessDeniedException("Tài khoản không thuộc trường nào"));
        schools.updateOwnProfile(schoolId, request.address(), request.moetCode());
        return SchoolResponse.from(schools.get(schoolId), rowLevel);
    }
}
