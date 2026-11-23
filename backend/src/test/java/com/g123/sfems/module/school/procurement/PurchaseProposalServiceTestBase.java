package com.g123.sfems.module.school.procurement;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.intake.EquipmentIntakeService;
import com.g123.sfems.module.school.voucher.VoucherCampus;
import com.g123.sfems.module.school.voucher.VoucherForms;
import com.g123.sfems.module.school.voucher.VoucherServiceDeps;
import com.g123.sfems.module.school.voucher.VoucherWorkflow;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/** Mock chung cho các test của {@link PurchaseProposalService}. Trường số 1 thuộc Sở số 10. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
abstract class PurchaseProposalServiceTestBase {

    @Mock RowLevelSecurity rowLevel;
    @Mock VoucherWorkflow workflow;
    @Mock SchoolService schools;
    @Mock RowLevelPrincipalResolver principals;
    @Mock EntityManager entityManager;
    @Mock VoucherForms forms;
    @Mock VoucherCampus campus;
    @Mock PurchaseProposalRepository repository;
    @Mock EquipmentCatalogService catalogs;
    @Mock AdequacyService adequacy;
    @Mock EquipmentIntakeService intakes;

    PurchaseProposalService service;
    School school;

    @BeforeEach
    void baseSetUp() {
        VoucherServiceDeps deps = new VoucherServiceDeps(rowLevel, workflow, schools, principals, entityManager,
                forms, campus);
        service = spy(new PurchaseProposalService(deps, repository, catalogs, adequacy, intakes));
        school = ProcurementFixtures.school(1L, 10L);
        when(schools.get(1L)).thenReturn(school);
        when(repository.persist(any())).thenAnswer(inv -> inv.getArgument(0));
        when(adequacy.snapshot(anyLong(), anyLong())).thenReturn(new AdequacyService.Snapshot(3, 10));
    }
}
