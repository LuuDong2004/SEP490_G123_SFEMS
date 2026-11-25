package com.g123.sfems.module.organization.school.security;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.shared.data.rls.DbRowScope;
import com.g123.sfems.shared.data.rls.DbRowScopeSource;
import com.g123.sfems.shared.security.CurrentUser;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Phạm vi trường cho RLS của PostgreSQL — cùng câu trả lời với {@link VisibleSchools} (báo cáo, tổng hợp) để lớp CSDL
 * không nói khác lớp ứng dụng: không đăng nhập → cho qua; quản trị hệ thống, Sở → mọi trường; trường → đúng trường
 * mình. Quản trị viên XEM được dữ liệu nghiệp vụ để hỗ trợ (Báo cáo 3 mục 4.4); việc ghi do cổng Admin và mã quyền
 * chặn (PortalRoutes, PermissionGrants), không phải tầng này.
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
        Set<Long> ids = visibleSchools.current();
        return ids == null ? DbRowScope.all() : DbRowScope.schools(ids);
    }
}
