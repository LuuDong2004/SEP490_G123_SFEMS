package com.g123.sfems.shared.security;

/**
 * The permission codes seeded by {@code 005-seed-security.sql}, as constants.
 *
 * <p>These are compile-time constants so that {@code @PreAuthorize} can be
 * written as {@code hasAuthority(Permissions.USERS_WRITE)} — a typo becomes a
 * compile error instead of an endpoint that silently authorises nobody.
 *
 * <p>The code is {@code resource:action}, where the resource half is verbatim
 * the resource name the frontend declares in {@code routes.tsx}. That is not
 * cosmetic: it is what lets the admin UI's access control provider build the
 * code it needs from the resource and action it is already handed, rather than
 * carrying a second copy of this mapping that could drift.
 *
 * <p>Three actions cover the six Refine actions: {@code list}/{@code show} need
 * {@code read}, {@code create}/{@code edit}/{@code clone} need {@code write},
 * and {@code delete} needs {@code delete}.
 */
public final class Permissions {

    public static final String USERS_READ = "users:read";
    public static final String USERS_WRITE = "users:write";
    public static final String USERS_DELETE = "users:delete";

    public static final String ROLES_READ = "roles:read";
    public static final String ROLES_WRITE = "roles:write";
    public static final String ROLES_DELETE = "roles:delete";

    public static final String PERMISSIONS_READ = "permissions:read";

    /** Trục tổ chức: Sở/Phòng GD và các trường trực thuộc. */
    public static final String DEPARTMENTS_OF_EDUCATION_READ = "departments_of_education:read";
    public static final String DEPARTMENTS_OF_EDUCATION_WRITE = "departments_of_education:write";
    public static final String DEPARTMENTS_OF_EDUCATION_DELETE = "departments_of_education:delete";

    public static final String SCHOOLS_READ = "schools:read";
    public static final String SCHOOLS_WRITE = "schools:write";
    public static final String SCHOOLS_DELETE = "schools:delete";

    /** Danh mục dùng chung: cấp học. */
    public static final String EDUCATION_LEVELS_READ = "education_levels:read";
    public static final String EDUCATION_LEVELS_WRITE = "education_levels:write";
    public static final String EDUCATION_LEVELS_DELETE = "education_levels:delete";

    // ADMIN only, and 010 spells that out rather than joining: editing a data
    // scope is editing the security model, so it is not a grant to hand around.
    // There is deliberately no row-level scope on the policy table itself --
    // deciding which policies you may see would need the policies you may see.
    public static final String ROW_LEVEL_POLICIES_READ = "row_level_policies:read";
    public static final String ROW_LEVEL_POLICIES_WRITE = "row_level_policies:write";
    public static final String ROW_LEVEL_POLICIES_DELETE = "row_level_policies:delete";

    // Granted to every system role, unlike everything above. They gate the bell,
    // not access to anybody else's rows: every notification endpoint is scoped
    // to the caller. There is no notifications:write -- nobody edits a
    // notification, the application raises one, and the endpoint that raises one
    // for somebody else needs USERS_WRITE because that is what it really does.
    public static final String NOTIFICATIONS_READ = "notifications:read";
    public static final String NOTIFICATIONS_DELETE = "notifications:delete";

    private Permissions() {
    }
}
