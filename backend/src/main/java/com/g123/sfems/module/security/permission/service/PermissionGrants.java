package com.g123.sfems.module.security.permission.service;

import com.g123.sfems.domain.security.permission.Permission;
import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.shared.web.portal.Portal;
import com.g123.sfems.shared.web.portal.PortalRoutes;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Vai loại nào mang được quyền nào — MỘT luật cho màn Vai trò, dịch vụ vai và test (Báo cáo 3 mục 4.4).
 *
 * <p>Vai chỉ mang được quyền mà cổng của loại tài khoản đó mở ({@link PortalRoutes}): quyền cổng không mở thì tích vào
 * cũng không có tác dụng, nên không cho tích. Hệ quả: vai quản trị chỉ xem, xuất dữ liệu nghiệp vụ — khoá cứng, không
 * chỉ là cấu hình ban đầu. CSDL giữ cùng luật cho vai quản trị bằng trigger {@code role_permission_fits} (289).
 */
public final class PermissionGrants {

    private static final Set<String> READ_ACTIONS = Set.of("read", "export");

    /** Quyền đặt tên khác đoạn đường dẫn gác nó. */
    private static final Map<String, String> SEGMENT = Map.of("staff_accounts", "staff");

    /** Xác nhận, chốt năm học là việc của lãnh đạo trường: cổng Admin và Sở mở hồ sơ năm học nhưng không mở bước này. */
    private static final Set<String> SCHOOL_ONLY = Set.of("school_year_profiles:confirm");

    /** Phiếu có bước duyệt: một vai không vừa lập vừa duyệt cùng loại phiếu (GBR-07). */
    // Kế hoạch mua sắm KHÔNG nằm trong luật này (303): đó là việc nội bộ của Sở, Sở ít người — lãnh đạo Sở vừa lập
    // vừa duyệt được kế hoạch, kể cả kế hoạch mình lập. Phiếu của trường (ghi tăng, kiểm kê, đề xuất) vẫn giữ luật.
    private static final Map<String, String> VOUCHERS = Map.of(
            "equipment_intakes", "Phiếu ghi tăng",
            "inventory_sessions", "Phiếu kiểm kê",
            "purchase_proposals", "Đề xuất mua sắm");

    private PermissionGrants() {
    }

    public static boolean grantable(Permission permission, UserType roleType) {
        if (!permission.getScope().fits(roleType)) {
            return false;
        }
        String code = permission.getCode();
        if (SCHOOL_ONLY.contains(code)) {
            return roleType == UserType.SCHOOL;
        }
        String resource = resource(code);
        PortalRoutes.Rule rule = PortalRoutes.rule(SEGMENT.getOrDefault(resource, resource));
        if (rule == null) {
            return true;
        }
        Set<Portal> open = READ_ACTIONS.contains(action(code)) ? rule.read() : rule.write();
        return Arrays.stream(Portal.values()).anyMatch(p -> p.userType() == roleType && open.contains(p));
    }

    /** Tên các loại phiếu mà bộ quyền này vừa lập vừa duyệt; rỗng là hợp lệ. */
    public static List<String> selfApproving(Set<String> codes) {
        return VOUCHERS.entrySet().stream()
                .filter(v -> codes.contains(v.getKey() + ":write") && codes.contains(v.getKey() + ":approve"))
                .map(Map.Entry::getValue)
                .sorted()
                .toList();
    }

    private static String resource(String code) {
        return code.substring(0, code.indexOf(':'));
    }

    private static String action(String code) {
        return code.substring(code.indexOf(':') + 1);
    }
}
