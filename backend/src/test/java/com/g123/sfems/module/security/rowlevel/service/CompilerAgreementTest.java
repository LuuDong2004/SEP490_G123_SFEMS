package com.g123.sfems.module.security.rowlevel.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.security.rowlevel.Tri;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * T4 — the test the whole design exists to make possible, and the one that must
 * never be deleted.
 *
 * <p>A policy is compiled twice: once into SQL, through {@code
 * PredicateCompiler}, and once into an in-memory decision, through {@code
 * EntityEvaluator}. The first decides which rows a list returns; the second
 * decides whether a save is allowed and which buttons a row gets. If they ever
 * disagree, a row is visible in a list and refused on save, or worse, refused
 * in a list and accepted on save.
 *
 * <p>So: for each tree, the set of school ids the database returns must be
 * exactly the set the in-memory evaluator accepts. The fixture is built
 * specifically to cover the cases where the two are most likely to part company
 * — a {@code not} over a nullable field, a null foreign key inside an {@code
 * EXISTS}, a context key that resolves to null, and an empty set.
 *
 * <h2>Vì sao fixture là {@code schools} chứ không phải {@code tasks}</h2>
 *
 * <p>Test này vốn chạy trên {@code tasks}, một tính năng của nền
 * dth-framework. Khi {@code tasks} bị xoá cùng cặp mẫu
 * {@code organizations}/{@code departments}, fixture chuyển sang {@code
 * schools} — resource đầu tiên của dự án này nằm trong diện phân quyền dòng.
 *
 * <p>Việc chuyển giữ nguyên bốn lớp trường hợp, và đó là điều kiện để chuyển:
 *
 * <ul>
 *   <li>khoá ngoại RỖNG bên trong {@code EXISTS} — {@code educationLevel}
 *   <li>giá trị vô hướng RỖNG — {@code ward}
 *   <li>khoá ngữ cảnh phân giải thành rỗng — {@code user.schoolId}
 *   <li>tập rỗng — {@code in}/{@code notIn} với {@code []}
 * </ul>
 *
 * <p>Một lớp KHÔNG chuyển được: {@code tasks.dueDate} là một NGÀY cho phép
 * rỗng, còn {@code schools} không có trường ngày nào rỗng được. Các toán tử
 * theo khoảng vẫn được kiểm trên {@code createdAt}; riêng "ngày rỗng" thì
 * ngữ nghĩa của nó giống hệt "vô hướng rỗng", vốn đã được {@code ward} kiểm.
 */
@SpringBootTest
@Transactional
class CompilerAgreementTest {

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private RowLevelRegistry registry;

    @Autowired
    private PolicyCompiler compiler;

    @Autowired
    private ScopeTreeCodec codec;

    @Autowired
    private PredicateCompiler predicates;

    @Autowired
    private EntityEvaluator evaluator;

    private RowLevelRegistry.Managed schools;
    private List<School> fixture;
    private DepartmentOfEducation department;
    private EducationLevel level;

    /**
     * Every combination of "the field is null" against "the field is the value
     * the policy is about", for the nullable association and the nullable
     * scalar.
     *
     * <p>Written out rather than reused from the seed data, because the seed is
     * reference content that somebody will reasonably change, and the cases that
     * matter here are precisely the awkward ones nobody puts in seed data.
     */
    @BeforeEach
    void setUp() {
        schools = registry.byResource("schools").orElseThrow();

        department = entityManager
                .createQuery("select d from DepartmentOfEducation d order by d.id",
                        DepartmentOfEducation.class)
                .setMaxResults(1).getSingleResult();
        level = entityManager
                .createQuery("select e from EducationLevel e order by e.id", EducationLevel.class)
                .setMaxResults(1).getSingleResult();

        fixture = new ArrayList<>();
        fixture.add(school("both-set", level, "Phuong 1"));
        fixture.add(school("no-level", null, "Phuong 1"));
        fixture.add(school("no-ward", level, null));
        fixture.add(school("neither", null, null));

        entityManager.flush();
    }

    static Stream<String> trees() {
        return Stream.of(
                // The plain cases, to prove the harness itself works.
                """
                { "field": "id", "op": "eq", "value": { "ctx": "user.schoolId" } }""",
                """
                { "field": "educationLevel.id", "op": "isNotNull" }""",
                """
                { "field": "status", "op": "in", "value": { "lit": ["ACTIVE", "INACTIVE"] } }""",

                // A not over an association. Without normalisation this is the
                // NOT EXISTS that accepts a row whose foreign key is null while
                // three-valued logic refuses it.
                """
                { "not": { "field": "educationLevel.id", "op": "isNotNull" } }""",
                """
                { "not": { "field": "departmentOfEducation.id", "op": "isNull" } }""",

                // A not over a nullable column.
                """
                { "not": { "field": "wardText", "op": "eq", "value": { "lit": "Phuong 1" } } }""",

                // De Morgan across a whole subtree.
                """
                { "not": { "all": [
                    { "field": "wardText",              "op": "eq",        "value": { "lit": "Phuong 1" } },
                    { "field": "educationLevel.id", "op": "isNotNull" }
                ]}}""",
                """
                { "not": { "any": [
                    { "field": "wardText",              "op": "eq",        "value": { "lit": "Phuong 1" } },
                    { "field": "educationLevel.id", "op": "isNotNull" }
                ]}}""",

                // The isNull branch somebody has to write out by hand once they
                // understand why the not above does not match a null.
                """
                { "any": [
                    { "not": { "field": "wardText", "op": "eq", "value": { "lit": "Phuong 1" } } },
                    { "field": "wardText", "op": "isNull" }
                ]}""",
                """
                { "field": "wardText", "op": "isNull" }""",
                """
                { "field": "departmentOfEducation.id", "op": "isNotNull" }""",

                // Empty sets, where the answer is a definition this design made
                // rather than something SQL could express: `x IN ()` cannot be
                // written at all.
                """
                { "field": "status", "op": "in", "value": { "lit": [] } }""",
                """
                { "field": "educationLevel.id", "op": "notIn", "value": { "lit": [] } }""",

                // Ranges, and the negation that becomes any[lt, gt].
                """
                { "field": "createdAt", "op": "between",
                  "value": { "lit": ["2000-01-01T00:00:00Z", "2100-01-01T00:00:00Z"] } }""",
                """
                { "not": { "field": "createdAt", "op": "between",
                           "value": { "lit": ["2000-01-01T00:00:00Z", "2100-01-01T00:00:00Z"] } } }""",

                // The full scope and the empty one.
                "{ \"all\": [] }",
                "{ \"any\": [] }");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("trees")
    @DisplayName("T4: SQL and the in-memory evaluator select exactly the same rows")
    void bothCompilersAgree(String json) {
        ScopePlan plan = compiler.compile(schools, Action.READ, codec.parse(json));

        // A principal whose school is one of the fixture rows, so the
        // conditions actually split the rows rather than matching all or none.
        RowLevelPrincipal principal = principal(fixture.get(0).getId());

        assertEquals(
                inMemory(plan, principal),
                fromDatabase(plan, principal),
                "the two compilers disagree about " + json);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("trees")
    @DisplayName("T4: they still agree when a context key resolves to null")
    void bothCompilersAgreeWithNullContext(String json) {
        ScopePlan plan = compiler.compile(schools, Action.READ, codec.parse(json));

        // Somebody in no school. A comparison against nothing is UNKNOWN, and
        // UNKNOWN refuses the row -- on both sides.
        RowLevelPrincipal principal = principal(null);

        assertEquals(
                inMemory(plan, principal),
                fromDatabase(plan, principal),
                "the two compilers disagree about " + json + " when the context is null");
    }

    @org.junit.jupiter.api.Test
    @DisplayName("Three-valued logic in practice: not(ward = X) does not match a school with no ward")
    void notDoesNotMatchNull() {
        ScopePlan plan = compiler.compile(schools, Action.READ, codec.parse("""
                { "not": { "field": "wardText", "op": "eq", "value": { "lit": "Phuong 1" } } }"""));
        RowLevelPrincipal principal = principal(fixture.get(0).getId());

        School noWard = fixture.get(2);
        assertEquals(Tri.UNKNOWN, evaluator.evaluate(plan, noWard, principal));
        assertFalse(fromDatabase(plan, principal).contains(noWard.getId()),
                "a school with no ward must not be selected by a negated condition on the ward");

        // And the branch somebody writes to get the other behaviour does match.
        ScopePlan spelledOut = compiler.compile(schools, Action.READ, codec.parse("""
                { "any": [
                    { "not": { "field": "wardText", "op": "eq", "value": { "lit": "Phuong 1" } } },
                    { "field": "wardText", "op": "isNull" }
                ]}"""));
        assertTrue(fromDatabase(spelledOut, principal).contains(noWard.getId()));
    }

    /** The ids the database returns for this plan, restricted to the fixture. */
    private Set<Long> fromDatabase(ScopePlan plan, RowLevelPrincipal principal) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> query = cb.createQuery(Long.class);
        Root<School> root = query.from(School.class);

        query.select(root.get("id")).where(cb.and(
                root.get("id").in(fixture.stream().map(School::getId).toList()),
                predicates.toPredicate(plan, root, query, cb, principal)));

        return new LinkedHashSet<>(entityManager.createQuery(query).getResultList());
    }

    /** The ids the in-memory evaluator accepts, over the same rows. */
    private Set<Long> inMemory(ScopePlan plan, RowLevelPrincipal principal) {
        Set<Long> accepted = new LinkedHashSet<>();
        for (School school : fixture) {
            if (evaluator.evaluate(plan, school, principal).isTrue()) {
                accepted.add(school.getId());
            }
        }
        return accepted;
    }

    private School school(String code, EducationLevel educationLevel, String ward) {
        School school = new School(department, "FIXTURE-" + code, "Fixture " + code);
        school.setEducationLevel(educationLevel);
        // `wardText` chứ không phải `ward`: địa bàn giờ là khoá ngoại, còn thứ
        // bài kiểm này cần là một VÔ HƯỚNG CHO PHÉP RỖNG.
        school.setWardText(ward);
        entityManager.persist(school);
        return school;
    }

    private static RowLevelPrincipal principal(Long schoolId) {
        return new RowLevelPrincipal(1L, schoolId, null, null, Set.of("USER"), Set.of(1L));
    }
}
