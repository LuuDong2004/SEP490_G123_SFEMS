package com.g123.sfems.module.school.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sheet "createPlan" — ProcurementPlanService.create (NC-05: lập kế hoạch mua sắm). */
class ProcurementPlanServiceCreateTest extends ProcurementPlanServiceTestBase {

    DepartmentOfEducation body10;

    @BeforeEach
    void setUp() {
        body10 = ProcurementFixtures.body(10L);
        when(bodies.get(10L)).thenReturn(body10);
        when(jdbc.queryForList(contains("SELECT code FROM procurement_plans"), eq(String.class), any()))
                .thenReturn(List.of());
    }

    static ProcurementPlanService.Input input(String title, Integer budgetYear, Long schoolYearId) {
        return new ProcurementPlanService.Input(null, title, budgetYear, schoolYearId, null, null, null, null);
    }

    void expectError(ProcurementPlanService.Input in, String message) {
        assertThatThrownBy(() -> service.create(in))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining(message);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("UTCID01 - N: chuyên viên Sở lập kế hoạch → Nháp, mã KHMS-2027-001")
    void utcid01() {
        ProcurementPlan plan = service.create(input("Kế hoạch mua sắm 2027", 2027, null));
        assertThat(plan.getStatus()).isEqualTo(ProcurementPlan.Status.DRAFT);
        assertThat(plan.getCode()).isEqualTo("KHMS-2027-001");
        assertThat(plan.getManagingBody()).isSameAs(body10);
        assertThat(plan.getPlanDate()).isEqualTo(LocalDate.now());
        verify(repository).save(plan);
    }

    @Test
    @DisplayName("UTCID02 - N: đã có KHMS-2027-001 và -005 → mã tiếp theo -006")
    void utcid02() {
        when(jdbc.queryForList(contains("SELECT code FROM procurement_plans"), eq(String.class), eq("KHMS-2027-%")))
                .thenReturn(List.of("KHMS-2027-001", "KHMS-2027-005"));
        assertThat(service.create(input("KH bổ sung", 2027, null)).getCode()).isEqualTo("KHMS-2027-006");
    }

    @Test
    @DisplayName("UTCID03 - N: chọn năm học 2026-2027 → năm ngân sách 2027")
    void utcid03() {
        SchoolYear year = new SchoolYear();
        year.setEndDate(LocalDate.of(2027, 5, 31));
        when(schoolYears.get(7L)).thenReturn(year);
        ProcurementPlan plan = service.create(input("KH theo năm học", null, 7L));
        assertThat(plan.getBudgetYear()).isEqualTo(2027);
        assertThat(plan.getSchoolYear()).isSameAs(year);
    }

    @Test
    @DisplayName("UTCID04 - A: thiếu tên kế hoạch (MSG23)")
    void utcid04() {
        expectError(input(null, 2027, null), "Nhập tên kế hoạch và chọn năm học");
    }

    @Test
    @DisplayName("UTCID05 - B: tên kế hoạch chỉ có khoảng trắng (MSG23)")
    void utcid05() {
        expectError(input("   ", 2027, null), "Nhập tên kế hoạch và chọn năm học");
    }

    @Test
    @DisplayName("UTCID06 - A: không chọn năm học / năm ngân sách (MSG23)")
    void utcid06() {
        expectError(input("Kế hoạch", null, null), "Nhập tên kế hoạch và chọn năm học");
    }

    @Test
    @DisplayName("UTCID07 - B: năm ngân sách 1999")
    void utcid07() {
        expectError(input("Kế hoạch", 1999, null), "Năm ngân sách không hợp lệ");
    }

    @Test
    @DisplayName("UTCID08 - B: năm ngân sách 2000")
    void utcid08() {
        assertThat(service.create(input("Kế hoạch", 2000, null)).getCode()).isEqualTo("KHMS-2000-001");
    }

    @Test
    @DisplayName("UTCID09 - B: năm ngân sách 2100")
    void utcid09() {
        assertThat(service.create(input("Kế hoạch", 2100, null)).getBudgetYear()).isEqualTo(2100);
    }

    @Test
    @DisplayName("UTCID10 - B: năm ngân sách 2101")
    void utcid10() {
        expectError(input("Kế hoạch", 2101, null), "Năm ngân sách không hợp lệ");
    }

    @Test
    @DisplayName("UTCID11 - A: tài khoản trường lập kế hoạch (MSG22)")
    void utcid11() {
        loginAs(ProcurementFixtures.schoolUser(1L));
        expectError(input("Kế hoạch", 2027, null), "Chỉ tài khoản thuộc Sở mới lập được kế hoạch mua sắm");
    }

    @Test
    @DisplayName("UTCID12 - N: quản trị viên lập cho Sở được chọn")
    void utcid12() {
        loginAs(ProcurementFixtures.admin());
        ProcurementPlanService.Input in = new ProcurementPlanService.Input(10L, "Kế hoạch", 2027, null, null, null,
                null, null);
        assertThat(service.create(in).getManagingBody()).isSameAs(body10);
    }

    @Test
    @DisplayName("UTCID13 - A: quản trị viên không chọn Sở (MSG22)")
    void utcid13() {
        loginAs(ProcurementFixtures.admin());
        expectError(input("Kế hoạch", 2027, null), "Chỉ tài khoản thuộc Sở");
    }

    @Test
    @DisplayName("UTCID14 - N: nhập ngày lập và ghi chú → giữ ngày, trim ghi chú, trim tên")
    void utcid14() {
        ProcurementPlanService.Input in = new ProcurementPlanService.Input(null, "  KH 2027  ", 2027, null,
                LocalDate.of(2026, 12, 1), "  Ưu tiên phòng thí nghiệm  ", null, null);
        ProcurementPlan plan = service.create(in);
        assertThat(plan.getTitle()).isEqualTo("KH 2027");
        assertThat(plan.getPlanDate()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(plan.getNote()).isEqualTo("Ưu tiên phòng thí nghiệm");
    }
}
