package com.g123.sfems.module.school.procurement;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.voucher.VoucherForms;
import com.g123.sfems.module.school.voucher.VoucherWorkflow;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

/** Mock chung cho các test của {@link ProcurementPlanService}. Kế hoạch số 1 của Sở số 10. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
abstract class ProcurementPlanServiceTestBase {

    @Mock ProcurementPlanRepository repository;
    @Mock PurchaseProposalRepository proposals;
    @Mock RowLevelPrincipalResolver principals;
    @Mock RowLevelSecurity rowLevel;
    @Mock DepartmentOfEducationService bodies;
    @Mock ManagedSchoolsCache managedSchools;
    @Mock VoucherWorkflow workflow;
    @Mock VisibleSchools visibleSchools;
    @Mock JdbcTemplate jdbc;
    @Mock VoucherForms forms;
    @Mock SchoolYearService schoolYears;

    ProcurementPlanService service;

    @BeforeEach
    void baseSetUp() {
        service = spy(new ProcurementPlanService(repository, proposals, principals, rowLevel, bodies, managedSchools,
                workflow, visibleSchools, jdbc, forms, schoolYears));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(proposals.persist(any())).thenAnswer(inv -> inv.getArgument(0));
        // asSystem chỉ đổi ngữ cảnh phân quyền — trong unit test chạy thẳng phần việc bên trong.
        when(rowLevel.asSystem(anyString(), any(Supplier.class))).thenAnswer(inv -> ((Supplier<?>) inv.getArgument(1)).get());
        loginAs(ProcurementFixtures.bodyUser(10L));
    }

    void loginAs(RowLevelPrincipal principal) {
        when(principals.current()).thenReturn(Optional.ofNullable(principal));
    }

    /** Bỏ qua truy vấn có phân quyền của get(id): kế hoạch {@code id} là {@code plan}. */
    void givenPlan(ProcurementPlan plan) {
        doReturn(plan).when(service).get(plan.getId());
    }

    void givenProposalCount(Long planId, Integer count) {
        when(jdbc.queryForObject(contains("SELECT COUNT(*) FROM purchase_proposals"), eq(Integer.class), eq(planId)))
                .thenReturn(count);
    }

    void givenPlannedSum(Long planId, Integer sum) {
        when(jdbc.queryForObject(contains("SUM(l.planned_quantity)"), eq(Integer.class), eq(planId))).thenReturn(sum);
    }

    void givenUnpriced(Long planId, List<String> rows) {
        when(jdbc.queryForList(contains("planned_unit_price"), eq(String.class), eq(planId))).thenReturn(rows);
    }
}
