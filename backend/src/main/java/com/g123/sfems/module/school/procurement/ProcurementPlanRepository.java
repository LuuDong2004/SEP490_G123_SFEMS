package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** Kế hoạch không thuộc trường nào nên không qua phạm vi dòng; ai thấy gì do service quyết định. */
public interface ProcurementPlanRepository
        extends JpaRepository<ProcurementPlan, Long>, JpaSpecificationExecutor<ProcurementPlan> {
}
