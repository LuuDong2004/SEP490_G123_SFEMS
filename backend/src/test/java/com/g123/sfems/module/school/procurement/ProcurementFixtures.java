package com.g123.sfems.module.school.procurement;

import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Dữ liệu dựng sẵn cho unit test luồng BF-01 "Nhu cầu và kế hoạch mua sắm".
 * School / DepartmentOfEducation có constructor protected nên dùng mock; các entity còn lại dựng thật.
 */
public final class ProcurementFixtures {

    private ProcurementFixtures() {
    }

    public static <T> T withId(T entity, Long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }

    public static DepartmentOfEducation body(Long id) {
        DepartmentOfEducation body = mock(DepartmentOfEducation.class);
        lenient().when(body.getId()).thenReturn(id);
        lenient().when(body.getName()).thenReturn("Sở GD&ĐT " + id);
        return body;
    }

    /** Trường {@code schoolId} thuộc Sở {@code bodyId} ({@code null} = trường không có cơ quan quản lý). */
    public static School school(Long schoolId, Long bodyId) {
        School school = mock(School.class);
        lenient().when(school.getId()).thenReturn(schoolId);
        lenient().when(school.getName()).thenReturn("THPT " + schoolId);
        DepartmentOfEducation body = bodyId == null ? null : body(bodyId);
        lenient().when(school.getDepartmentOfEducation()).thenReturn(body);
        return school;
    }

    public static EquipmentCatalog catalog(Long id, String name) {
        EquipmentCatalog catalog = withId(new EquipmentCatalog(), id);
        catalog.setCode("TB" + id);
        catalog.setName(name);
        return catalog;
    }

    public static PurchaseProposalLine line(Long id, EquipmentCatalog catalog, Integer quantity, BigDecimal price) {
        PurchaseProposalLine line = withId(new PurchaseProposalLine(), id);
        line.setLineNo(1);
        line.setKind(PurchaseProposalLine.Kind.NEW);
        line.setCatalog(catalog);
        line.setName(catalog.getName());
        line.setQuantity(quantity);
        line.setUnitPrice(price);
        return line;
    }

    public static PurchaseProposal proposal(Long id, School school, VoucherStatus status, PurchaseProposalLine... lines) {
        PurchaseProposal p = withId(new PurchaseProposal(), id);
        p.setSchool(school);
        p.setStatus(status);
        p.setCode("MS-2027-" + String.format("%03d", id));
        p.setProposalDate(LocalDate.of(2026, 11, 23));
        p.setBudgetYear(2027);
        p.replaceLines(List.of(lines));
        return p;
    }

    public static ProcurementPlan plan(Long id, Long bodyId, ProcurementPlan.Status status) {
        ProcurementPlan plan = withId(new ProcurementPlan(), id);
        plan.setManagingBody(body(bodyId));
        plan.setStatus(status);
        plan.setTitle("Kế hoạch mua sắm 2027");
        plan.setBudgetYear(2027);
        plan.setCode("KHMS-2027-001");
        return plan;
    }

    /** Cán bộ / lãnh đạo trường. */
    public static RowLevelPrincipal schoolUser(Long schoolId) {
        return new RowLevelPrincipal(100L, schoolId, null, null, Set.of("SCHOOL_STAFF"), Set.of());
    }

    /** Chuyên viên / lãnh đạo Sở. */
    public static RowLevelPrincipal bodyUser(Long bodyId) {
        return new RowLevelPrincipal(200L, null, bodyId, null, Set.of("DEPT_STAFF"), Set.of());
    }

    public static RowLevelPrincipal admin() {
        return new RowLevelPrincipal(1L, null, null, null, Set.of("ADMIN"), Set.of());
    }
}
