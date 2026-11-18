package com.g123.sfems.module.security.user.repo;

import com.g123.sfems.domain.security.user.SchoolUser;
import com.g123.sfems.domain.security.user.SoUser;
import com.g123.sfems.domain.security.user.SystemUser;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/**
 * Translates the parsed query string into a JPA {@link Specification}.
 *
 * <p>Unknown fields are ignored rather than rejected, as everywhere else: the
 * admin UI is free to add a filter control before the backend knows about it,
 * and a 400 there would blank the whole table instead of merely failing to
 * narrow it.
 */
public final class UserSpecifications {

    private UserSpecifications() {
    }

    public static Specification<User> from(ListParams params) {
        List<Specification<User>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<User> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "username" -> textSpec("username", criterion);
                case "email" -> textSpec("email", criterion);
                case "fullName" -> textSpec("fullName", criterion);
                case "status" -> statusSpec(criterion);
                // The list view filters by role through the nested id the
                // response reports, so the field arrives as "roles.id".
                case "roles.id", "roleId" -> roleSpec(criterion);
                case "school.id", "schoolId" -> placementSpec(criterion);
                case "userType" -> typeSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        // The quick filter is one term matched across the three text columns,
        // because the provider has no way to express an OR across fields.
        params.search().ifPresent(term -> specs.add((root, query, cb) -> cb.or(
                ListParams.foldedLike(cb, root.get("username"), term),
                ListParams.foldedLike(cb, root.get("email"), term),
                ListParams.foldedLike(cb, root.get("fullName"), term))));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<User> idSpec(ListParams.Criterion criterion) {
        Long id = parseId(criterion.value());
        if (id == null) {
            // A non-numeric id can never match; say so explicitly rather than
            // letting the filter silently disappear.
            return (root, query, cb) -> cb.disjunction();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get("id"), id);
            case NE -> (root, query, cb) -> cb.notEqual(root.get("id"), id);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("id"), id);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get("id"), id);
        };
    }

    private static Specification<User> textSpec(String field, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    ListParams.foldedLike(cb, root.get(field), value);
            case NE -> (root, query, cb) -> cb.notEqual(cb.lower(root.get(field)), value.toLowerCase());
            default -> (root, query, cb) -> cb.equal(cb.lower(root.get(field)), value.toLowerCase());
        };
    }

    private static Specification<User> statusSpec(ListParams.Criterion criterion) {
        UserStatus status;
        try {
            status = UserStatus.from(criterion.value());
        } catch (IllegalArgumentException e) {
            // An unknown status is a filter that can never match, not a request
            // worth rejecting: same reasoning as an unknown field.
            return (root, query, cb) -> cb.disjunction();
        }
        if (status == null) {
            return null;
        }
        return switch (criterion.operator()) {
            case NE -> (root, query, cb) -> cb.notEqual(root.get("status"), status);
            default -> (root, query, cb) -> cb.equal(root.get("status"), status);
        };
    }

    /**
     * Filters by an assigned role.
     *
     * <p>An {@code EXISTS} over the roles rather than a join + {@code distinct}: the join would multiply rows,
     * and {@code distinct} breaks sorting by {@code school.name} (PostgreSQL wants every ORDER BY expression of a
     * DISTINCT query in its select list).
     */
    private static Specification<User> roleSpec(ListParams.Criterion criterion) {
        Long roleId = parseId(criterion.value());
        if (roleId == null) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> {
            Subquery<Long> holders = query.subquery(Long.class);
            Root<User> holder = holders.from(User.class);
            holders.select(holder.get("id")).where(
                    cb.equal(holder.get("id"), root.get("id")),
                    cb.equal(holder.join("roles", JoinType.INNER).get("id"), roleId));
            return cb.exists(holders);
        };
    }

    /**
     * Lọc theo trường ({@code school.id}). Trường nằm ở bảng con {@code user_schools} (docs/kien-truc/11), nên đi qua
     * truy vấn con trên {@link SchoolUser}. {@code _ne} CỐ Ý khớp cả tài khoản không thuộc trường nào (Sở, UBND,
     * quản trị) — "không thuộc trường này" hiển nhiên gồm "không thuộc trường nào".
     */
    private static Specification<User> placementSpec(ListParams.Criterion criterion) {
        Long id = parseId(criterion.value());
        if (id == null) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> {
            Subquery<Long> members = query.subquery(Long.class);
            Root<SchoolUser> su = members.from(SchoolUser.class);
            members.select(su.get("id")).where(cb.equal(su.get("school").get("id"), id));
            var in = root.get("id").in(members);
            return criterion.operator() == ListParams.Operator.NE ? cb.not(in) : in;
        };
    }

    /** Lọc theo loại tài khoản (SYSTEM / SO / SCHOOL) — theo lớp con. */
    private static Specification<User> typeSpec(ListParams.Criterion criterion) {
        UserType type;
        try {
            type = UserType.valueOf(criterion.value().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return (root, query, cb) -> cb.disjunction();
        }
        Class<? extends User> subtype = switch (type) {
            case SYSTEM -> SystemUser.class;
            case SO -> SoUser.class;
            case SCHOOL -> SchoolUser.class;
        };
        return (root, query, cb) -> criterion.operator() == ListParams.Operator.NE
                ? cb.notEqual(root.type(), subtype)
                : cb.equal(root.type(), subtype);
    }

    private static Long parseId(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
