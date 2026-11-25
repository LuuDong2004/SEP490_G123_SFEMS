package com.g123.sfems.module.security.rowlevel.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.shared.security.rowlevel.DefaultScope;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.security.rowlevel.Tri;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * T1 and T5 — how rules combine, and the property that makes the combination
 * safe to hand to an administrator.
 *
 * <p>Built out of hand-made {@link EffectiveScope}s rather than through the
 * database, because these are claims about <em>combination</em>, and the
 * combining is the part with no SQL in it. That an individual rule means the
 * same thing to both compilers is {@link CompilerAgreementTest}'s job.
 */
class ScopeAlgebraTest {

    /** Only {@code evaluator} is reached on these paths; the rest belong to the SQL side. */
    private final RowLevelSecurityImpl security = new RowLevelSecurityImpl(
            null, null, null, null, new EntityEvaluator(), null);

    @Test
    @DisplayName("T1: scopes union, so a second role can only ever widen")
    void scopesUnion() {
        School todo = school(OrgStatus.ACTIVE, "ACTIVE-1");

        List<EffectiveScope.Contribution> both = List.of(
                matching("CLOSER", false),   // mọi thứ trừ ACTIVE
                matching("OPENER", true));   // chỉ ACTIVE
        EffectiveScope effective = scope(DefaultScope.NONE, both, List.of());

        assertEquals(Tri.FALSE, security.evaluate(effective, todo, holding("CLOSER")));
        assertEquals(Tri.TRUE, security.evaluate(effective, todo, holding("CLOSER", "OPENER")));
    }

    @Test
    @DisplayName("T1 and T6: filters intersect, and there is no role to not-hold in order to escape one")
    void filtersIntersect() {
        School todo = school(OrgStatus.ACTIVE, "ACTIVE-1");

        EffectiveScope wideOpen = scope(DefaultScope.FULL, List.of(), List.of());
        assertEquals(Tri.TRUE, security.evaluate(wideOpen, todo, holding()));

        EffectiveScope forbidden = scope(DefaultScope.FULL, List.of(), List.of(refusing()));
        assertEquals(Tri.FALSE, security.evaluate(forbidden, todo, holding()));
        assertEquals(Tri.FALSE, security.evaluate(forbidden, todo, holding("OPENER")));
    }

    @Test
    @DisplayName("T1: with no applicable scope, the resource's declared default decides")
    void defaultScopeApplies() {
        School todo = school(OrgStatus.ACTIVE, "ACTIVE-1");

        assertEquals(Tri.TRUE,
                security.evaluate(scope(DefaultScope.FULL, List.of(), List.of()), todo, holding()));
        assertEquals(Tri.FALSE,
                security.evaluate(scope(DefaultScope.NONE, List.of(), List.of()), todo, holding()));
    }

    @Test
    @DisplayName("T1: a scope belonging to a role the caller does not hold contributes nothing")
    void scopesOfOtherRolesAreIgnored() {
        EffectiveScope somebodyElses =
                scope(DefaultScope.NONE, List.of(matching("SOMEBODY_ELSE", true)), List.of());

        assertEquals(Tri.FALSE, security.evaluate(somebodyElses, school(OrgStatus.ACTIVE, "ACTIVE-1"), holding("OPENER")));
    }

    @Test
    @DisplayName("T14: a quarantined FILTER closes the pair rather than letting the prohibition vanish")
    void blockedRefusesEverything() {
        EffectiveScope blocked = new EffectiveScope("schools", DefaultScope.FULL, List.of(), List.of(), true);
        assertEquals(Tri.FALSE, security.evaluate(blocked, school(OrgStatus.ACTIVE, "ACTIVE-1"), holding("OPENER")));
    }

    /**
     * T5 — monotonicity, generatively, under {@link DefaultScope#NONE}.
     *
     * <p>The property an administrator relies on without ever being told about
     * it: granting an extra role must never take a row away. It holds because
     * scopes are unioned, and it would break the moment somebody "fixed" that to
     * an intersection — a change that looks entirely reasonable in isolation,
     * which is why this is generated rather than a handful of examples.
     */
    @Test
    @DisplayName("T5: under NONE, adding a role never reduces what is visible")
    void addingARoleNeverRemovesRows() {
        Random random = new Random(20260903L);
        // Năm bản ghi mang mã riêng để phân biệt, xen kẽ hai trạng thái —
        // OrgStatus chỉ có hai giá trị, nên "khác nhau" ở đây là mã chứ không
        // phải trạng thái. Điều kiện bên dưới chỉ soi trạng thái, và đó là tất
        // cả những gì phép hợp cần để kiểm.
        List<School> rows = List.of(
                school(OrgStatus.ACTIVE, "S1"), school(OrgStatus.INACTIVE, "S2"),
                school(OrgStatus.ACTIVE, "S3"), school(OrgStatus.INACTIVE, "S4"),
                school(OrgStatus.ACTIVE, "S5"));
        List<String> allRoles = List.of("R1", "R2", "R3", "R4", "R5", "R6");

        for (int trial = 0; trial < 200; trial++) {
            List<EffectiveScope.Contribution> scopes = new ArrayList<>();
            for (String role : allRoles) {
                scopes.add(matching(role, random.nextBoolean()));
            }
            EffectiveScope effective = scope(DefaultScope.NONE, scopes, List.of());

            Set<String> held = new LinkedHashSet<>();
            Set<String> before = visible(effective, rows, held);

            for (String role : allRoles) {
                held.add(role);
                Set<String> after = visible(effective, rows, held);

                assertTrue(after.containsAll(before),
                        "adding %s removed rows: %s -> %s".formatted(role, before, after));
                before = after;
            }
        }
    }

    /**
     * The one place monotonicity does not hold, stated rather than hidden.
     *
     * <p>Under {@link DefaultScope#FULL}, an account holding no scoped role at
     * all falls through to "everything". Give it its first scoped role and it is
     * narrowed — so that one step does remove rows.
     *
     * <p>That is the price of {@code FULL}, and paying it is the whole reason
     * {@code FULL} exists: it is what lets a running resource be brought under
     * management without anybody losing a row on the day it ships. It is also
     * exactly what the coverage matrix colours red and what {@code /explain}
     * warns about, so it is visible rather than discovered. Every step
     * <em>after</em> the first still only widens, which the assertion below
     * pins down.
     */
    @Test
    @DisplayName("T5: under FULL the first scoped role narrows — and every role after it still only widens")
    void fullNarrowsOnlyOnTheFirstScopedRole() {
        School done = school(OrgStatus.INACTIVE, "INACTIVE-1");
        EffectiveScope effective = scope(
                DefaultScope.FULL,
                List.of(matching("OPENER", true), matching("CLOSER", false)),
                List.of());

        // No scoped role: not narrowed at all.
        assertEquals(Tri.TRUE, security.evaluate(effective, done, holding()));
        assertEquals(Tri.TRUE, security.evaluate(effective, done, holding("UNSCOPED")));

        // The first scoped role narrows. This is the documented cost of FULL.
        assertFalse(security.evaluate(effective, done, holding("OPENER")).isTrue());

        // And from there on, more roles only ever widen again.
        assertEquals(Tri.TRUE, security.evaluate(effective, done, holding("OPENER", "CLOSER")));
    }

    private Set<String> visible(EffectiveScope effective, List<School> rows, Set<String> roleCodes) {
        RowLevelPrincipal principal = holding(roleCodes.toArray(String[]::new));

        Set<String> codes = new LinkedHashSet<>();
        for (School row : rows) {
            if (security.evaluate(effective, row, principal).isTrue()) {
                codes.add(row.getCode());
            }
        }
        return codes;
    }

    private static EffectiveScope scope(
            DefaultScope defaultScope,
            List<EffectiveScope.Contribution> scopes,
            List<EffectiveScope.Contribution> filters) {

        return new EffectiveScope("schools", defaultScope, scopes, filters, false);
    }

    /**
     * A source-declared scope for one role. Design-time rather than runtime so
     * that the test needs no compiler and no database — and because it also
     * exercises the path where the two layers land in the same list.
     */
    private static EffectiveScope.Contribution matching(String roleCode, boolean matchActive) {
        return new EffectiveScope.Contribution(
                "test", roleCode, "scope for " + roleCode, null, null,
                new EffectiveScope.DesignTime(null, (entity, principal) -> {
                    boolean isActive = ((School) entity).getStatus() == OrgStatus.ACTIVE;
                    return Tri.of(isActive == matchActive);
                }));
    }

    private static EffectiveScope.Contribution refusing() {
        return new EffectiveScope.Contribution(
                "test", null, "nothing", null, null,
                new EffectiveScope.DesignTime(null, (entity, principal) -> Tri.FALSE));
    }

    private static RowLevelPrincipal holding(String... roleCodes) {
        return new RowLevelPrincipal(1L, 7L, null, null, Set.of(roleCodes), Set.of());
    }

    /**
     * Một bản ghi thuần trong bộ nhớ. Sở chủ quản để {@code null}: test này cố
     * ý không cần database, và không điều kiện nào ở đây đọc tới nó.
     */
    private static School school(OrgStatus status, String code) {
        School school = new School(null, code, code);
        school.setStatus(status);
        return school;
    }
}
