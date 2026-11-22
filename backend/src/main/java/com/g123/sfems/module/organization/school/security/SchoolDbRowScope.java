package com.g123.sfems.module.organization.school.security;

import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.shared.data.rls.DbRowScope;
import com.g123.sfems.shared.data.rls.DbRowScopeSource;
import com.g123.sfems.shared.security.CurrentUser;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Phạm vi trường cho RLS của PostgreSQL — cùng câu trả lời với {@link VisibleSchools} (báo cáo, tổng hợp) để lớp CSDL
 * không nói khác lớp ứng dụng: không đăng nhập → cho qua; quản trị hệ thống, Sở → mọi trường; UBND → trường mình
 * quản lý; trường → đúng trường mình.
 */
@Component
public class SchoolDbRowScope implements DbRowScopeSource {

    private final VisibleSchools visibleSchools;

    public SchoolDbRowScope(VisibleSchools visibleSchools) {
        this.visibleSchools = visibleSchools;
    }

    @Override
    public DbRowScope current() {
        if (CurrentUser.id().isEmpty()) {
            return DbRowScope.bypass();
        }
        // Quản trị hệ thống (người, token có phiên `sid`) chỉ quản trị, không thấy dữ liệu nghiệp vụ
        // (docs/kien-truc/11 §8): ở tầng CSDL là một danh sách trường rỗng. Khoá API của đối tác (token không phiên)
        // đi theo phạm vi của tài khoản dịch vụ như trước.
        if (CurrentUser.userType().orElse(null) == UserType.SYSTEM && CurrentUser.sessionId().isPresent()) {
            return DbRowScope.schools(Set.of());
        }
        Set<Long> ids = visibleSchools.current();
        return ids == null ? DbRowScope.all() : DbRowScope.schools(ids);
    }
}
