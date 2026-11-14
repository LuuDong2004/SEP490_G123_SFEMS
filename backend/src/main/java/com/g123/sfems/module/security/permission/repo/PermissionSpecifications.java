package com.g123.sfems.module.security.permission.repo;

import com.g123.sfems.domain.security.permission.Permission;
import com.g123.sfems.domain.security.permission.PermissionScope;
import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/**
 * Translates the parsed query string into a JPA {@link Specification}.
 *
 * <p>Unknown fields are ignored rather than rejected, for the same reason as
 * everywhere else: a 400 there would blank the whole table instead of just
 * failing to narrow it.
 */
public final class PermissionSpecifications {

    private PermissionSpecifications() {
    }

    public static Specification<Permission> from(ListParams params) {
        List<Specification<Permission>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<Permission> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "code" -> textSpec("code", criterion);
                case "name" -> textSpec("name", criterion);
                case "systemPermission" -> booleanSpec(criterion);
                case "scope" -> scopeSpec(criterion.value());
                case "roleType" -> fitsSpec(criterion.value());
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        // The quick filter matches the code and the name, which is what the
        // role form's permission picker searches on.
        params.search().ifPresent(term -> specs.add((root, query, cb) -> cb.or(
                ListParams.foldedLike(cb, root.get("code"), term),
                ListParams.foldedLike(cb, root.get("name"), term))));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<Permission> idSpec(ListParams.Criterion criterion) {
        Long id = parseId(criterion.value());
        if (id == null) {
            return (root, query, cb) -> cb.disjunction();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get("id"), id);
            case NE -> (root, query, cb) -> cb.notEqual(root.get("id"), id);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("id"), id);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get("id"), id);
        };
    }

    private static Specification<Permission> textSpec(String field, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    ListParams.foldedLike(cb, root.get(field), value);
            case NE -> (root, query, cb) -> cb.notEqual(root.get(field), value);
            default -> (root, query, cb) -> cb.equal(root.get(field), value);
        };
    }

    private static Specification<Permission> booleanSpec(ListParams.Criterion criterion) {
        boolean value = Boolean.parseBoolean(criterion.value().trim());
        return switch (criterion.operator()) {
            case NE -> (root, query, cb) -> cb.notEqual(root.get("systemPermission"), value);
            default -> (root, query, cb) -> cb.equal(root.get("systemPermission"), value);
        };
    }

    private static Specification<Permission> scopeSpec(String value) {
        PermissionScope scope;
        try {
            scope = PermissionScope.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> cb.equal(root.get("scope"), scope);
    }

    /** Quyền gán được cho vai loại {@code value} (docs/kien-truc/11 §11). */
    private static Specification<Permission> fitsSpec(String value) {
        UserType type;
        try {
            type = UserType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return (root, query, cb) -> cb.disjunction();
        }
        List<PermissionScope> fitting = Arrays.stream(PermissionScope.values()).filter(s -> s.fits(type)).toList();
        return (root, query, cb) -> root.get("scope").in(fitting);
    }

    private static Long parseId(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
