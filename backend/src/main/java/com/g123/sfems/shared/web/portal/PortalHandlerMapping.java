package com.g123.sfems.shared.web.portal;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Đăng ký mỗi endpoint {@code /api/<x>/...} thêm dưới các cổng mà {@link PortalRoutes} cho phép:
 * {@code /api/school/<x>/...}, {@code /api/so/<x>/...}… — cùng một phương thức controller, không viết lại.
 * Đọc (GET / HEAD) lấy cổng đọc, phương thức khác lấy cổng ghi.
 *
 * <p>{@code legacyApi = true}: đường dẫn cũ không tiền tố vẫn chạy song song trong lúc giao diện chuyển sang cổng
 * (docs/kien-truc/11, đợt 3–6); tắt đi thì chỉ còn đường qua cổng (và {@link PortalRoutes#UNGATED}).
 */
public class PortalHandlerMapping extends RequestMappingHandlerMapping {

    private final boolean legacyApi;
    /** Đoạn đầu chưa khai trong bảng phân cổng — {@code PortalRoutesTest} đòi rỗng. */
    private final Set<String> unclassified = new TreeSet<>();

    public PortalHandlerMapping(boolean legacyApi) {
        this.legacyApi = legacyApi;
    }

    @Override
    protected RequestMappingInfo getMappingForMethod(Method method, Class<?> handlerType) {
        RequestMappingInfo info = super.getMappingForMethod(method, handlerType);
        if (info == null || info.getPathPatternsCondition() == null) {
            return info;
        }
        Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
        boolean read = !methods.isEmpty() && methods.stream().allMatch(m -> m == RequestMethod.GET || m == RequestMethod.HEAD);
        List<String> paths = new ArrayList<>();
        boolean changed = false;
        for (String pattern : info.getPathPatternsCondition().getPatternValues()) {
            String segment = segment(pattern);
            if (segment == null || PortalRoutes.UNGATED.contains(segment)) {
                paths.add(pattern);
                continue;
            }
            PortalRoutes.Rule rule = PortalRoutes.rule(segment);
            if (rule == null) {
                unclassified.add(segment);
                paths.add(pattern);
                continue;
            }
            if (legacyApi) {
                paths.add(pattern);
            }
            Set<Portal> portals = EnumSet.noneOf(Portal.class);
            portals.addAll(read ? rule.read() : rule.write());
            if (!read) {
                portals.addAll(PortalRoutes.extraWrite(pattern));
            }
            for (Portal portal : portals) {
                paths.add("/api/" + portal.prefix() + pattern.substring("/api".length()));
            }
            changed = true;
        }
        if (!changed) {
            return info;
        }
        if (paths.isEmpty()) {
            // Không cổng nào được dùng phương thức này và đường cũ đã tắt: không đăng ký.
            return null;
        }
        return info.mutate().paths(new LinkedHashSet<>(paths).toArray(String[]::new)).build();
    }

    /** {@code /api/equipment/{id}} → {@code equipment}; ngoài {@code /api/} → null. */
    static String segment(String pattern) {
        if (!pattern.startsWith("/api/")) {
            return null;
        }
        String rest = pattern.substring("/api/".length());
        int slash = rest.indexOf('/');
        return slash < 0 ? rest : rest.substring(0, slash);
    }

    public Set<String> unclassified() {
        return Set.copyOf(unclassified);
    }
}
