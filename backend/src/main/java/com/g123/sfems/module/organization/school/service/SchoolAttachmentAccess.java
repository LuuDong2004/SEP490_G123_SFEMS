package com.g123.sfems.module.organization.school.service;

import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.data.RecordAccess;
import com.g123.sfems.shared.security.Permissions;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Tệp đính kèm của TRƯỜNG ({@code resource = schools}) — ảnh trường (ảnh đầu / ảnh được đánh dấu
 * là ảnh đại diện) hiện ở hộp thoại "Hồ sơ trường". Đọc được tệp là đọc được chính trường đó, theo
 * phạm vi dòng của {@code schools}. Ghi: ai sửa được trường đó (UBND / Sở), hoặc chính trường ấy khi
 * người gọi mang {@code school_profile:write} (239 — trường tự đổi ảnh của mình).
 */
@Component
public class SchoolAttachmentAccess implements RecordAccess {

    private final SchoolService schools;
    private final RowLevelPrincipalResolver principals;

    public SchoolAttachmentAccess(SchoolService schools, RowLevelPrincipalResolver principals) {
        this.schools = schools;
        this.principals = principals;
    }

    @Override
    public String resource() {
        return "schools";
    }

    @Override
    public void checkReadable(Long id) {
        schools.get(id);
    }

    @Override
    public void checkWritable(Long id) {
        if (ownSchool(id)) {
            return;
        }
        schools.getWritable(id);
    }

    private boolean ownSchool(Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean mayEditOwn = auth != null && auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(Permissions.SCHOOL_PROFILE_WRITE::equals);
        return mayEditOwn && principals.current()
                .map(RowLevelPrincipal::schoolId)
                .filter(id::equals)
                .isPresent();
    }
}
