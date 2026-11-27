package com.g123.sfems.module.school.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_MOCKS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.intake.EquipmentIntakeService;
import com.g123.sfems.module.school.intake.EquipmentIntakeService.PurchasedItem;
import com.g123.sfems.module.school.procurement.PurchaseProposalService.IntakePick;
import com.g123.sfems.module.school.voucher.VoucherCampus;
import com.g123.sfems.module.school.voucher.VoucherForms;
import com.g123.sfems.module.school.voucher.VoucherServiceDeps;
import com.g123.sfems.module.school.voucher.VoucherWorkflow;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Sheet createIntakeFromPlan — NC-07 Lập phiếu ghi tăng từ kế hoạch mua sắm:
 * {@link PurchaseProposalService#createIntake(Long, List)}.
 *
 * <p>Dữ liệu lấy từ CSDL đang chạy của dự án (bản sao lưu sfems_20261127-1350):
 * <ul>
 *   <li>cán bộ thiết bị Nguyễn Vũ Nghĩa (79000786.nghiavn, id 289) của THPT An Nghĩa (id 1503, mã 79000786), thuộc
 *   Sở Giáo dục và Đào tạo Thành phố Hồ Chí Minh (id 1);</li>
 *   <li>đề xuất MS-79000786-26-0001 (id 425), lý do "Bổ sung thiết bị còn thiếu theo chuẩn tối thiểu năm học
 *   2026-2027", đã Hoàn tất trong kế hoạch KHMS-2027-002 "mua sắm đề xuất 2026" (id 185) của Sở;</li>
 *   <li>ba dòng đưa vào kế hoạch: 543 Bộ thiết bị để vẽ trên bảng trong dạy học toán (nhóm 1703) 8 bộ, 111 đ;
 *   544 Bộ thiết dạy học về các đường cônic. (1704) 3 bộ, 1.111 đ; 545 Bộ thiết bị dạy học về Thống kê và Xác suất
 *   (1706) 38 bộ, 111.111 đ;</li>
 *   <li>phiếu ghi tăng hệ thống lập ra: id 310 (NK-79000786-26-0001 — phiếu thật đã lập từ đề xuất này).</li>
 * </ul>
 */
@TestMethodOrder(MethodOrderer.MethodName.class)
class PurchaseProposalCreateIntakeTest {

    static final long SCHOOL = 1503L;
    static final long PROPOSAL = 425L;
    static final String CODE = "MS-79000786-26-0001";
    static final long BOARD = 1703L;
    static final long CONIC = 1704L;
    static final long STATS = 1706L;
    static final String BOARD_NAME = "Bộ thiết bị để vẽ trên bảng trong dạy học toán";
    static final String CONIC_NAME = "Bộ thiết dạy học về các đường cônic.";
    static final String STATS_NAME = "Bộ thiết bị dạy học về Thống kê và Xác suất";
    static final String SO_NAME = "Sở Giáo dục và Đào tạo Thành phố Hồ Chí Minh";

    final PurchaseProposalRepository repository = mock(PurchaseProposalRepository.class);
    final RowLevelSecurity rowLevel = mock(RowLevelSecurity.class, RETURNS_MOCKS);
    final RowLevelPrincipalResolver principals = mock(RowLevelPrincipalResolver.class);
    final EntityManager entityManager = mock(EntityManager.class);
    final VoucherCampus campus = mock(VoucherCampus.class, RETURNS_MOCKS);
    final EquipmentIntakeService intakes = mock(EquipmentIntakeService.class);
    final PurchaseProposalService service = new PurchaseProposalService(
            new VoucherServiceDeps(rowLevel, mock(VoucherWorkflow.class), mock(SchoolService.class), principals,
                    entityManager, mock(VoucherForms.class), campus),
            repository, mock(EquipmentCatalogService.class), mock(AdequacyService.class), intakes);

    PurchaseProposal proposal;
    PurchaseProposalLine board;
    PurchaseProposalLine conic;
    PurchaseProposalLine stats;
    /** Số đã vào phiếu ghi tăng theo thiết bị (gồm cả phiếu chưa hoàn tất) và phần còn ở phiếu chưa hoàn tất. */
    Map<Long, Integer> received;
    Map<Long, Integer> pending;
    EquipmentIntake created;

    @BeforeEach
    void setUp() {
        // 79000786.nghiavn — Nguyễn Vũ Nghĩa, cán bộ thiết bị THPT An Nghĩa.
        when(principals.current()).thenReturn(Optional.of(
                new RowLevelPrincipal(289L, SCHOOL, null, null, Set.of("SCHOOL_STAFF"), Set.of())));
        DepartmentOfEducation so = new DepartmentOfEducation("SGD-HCM", SO_NAME, ManagingBodyType.SO);
        ReflectionTestUtils.setField(so, "id", 1L);
        School school = new School(so, "79000786", "THPT An Nghĩa");
        ReflectionTestUtils.setField(school, "id", SCHOOL);
        ProcurementPlan plan = new ProcurementPlan();
        ReflectionTestUtils.setField(plan, "id", 185L);
        plan.setCode("KHMS-2027-002");
        plan.setTitle("mua sắm đề xuất 2026");
        plan.setBudgetYear(2027);
        plan.setManagingBody(so);

        proposal = new PurchaseProposal();
        ReflectionTestUtils.setField(proposal, "id", PROPOSAL);
        proposal.setSchool(school);
        proposal.setCode(CODE);
        proposal.setStatus(VoucherStatus.COMPLETED);
        proposal.setBudgetYear(2027);
        proposal.setReason("Bổ sung thiết bị còn thiếu theo chuẩn tối thiểu năm học 2026-2027");
        proposal.setPlan(plan);
        board = line(543L, 1, BOARD, BOARD_NAME, 8, "111");
        conic = line(544L, 2, CONIC, CONIC_NAME, 3, "1111");
        stats = line(545L, 3, STATS, STATS_NAME, 38, "111111");
        proposal.replaceLines(new ArrayList<>(List.of(board, conic, stats)));

        when(repository.findOne(Mockito.<Specification<PurchaseProposal>>any())).thenReturn(Optional.of(proposal));
        when(repository.persist(any())).thenAnswer(inv -> inv.getArgument(0));
        received = new HashMap<>();
        pending = new HashMap<>();
        when(intakes.receivedBySource(PurchaseProposalService.RESOURCE, PROPOSAL)).thenAnswer(inv -> received);
        when(intakes.pendingBySource(PurchaseProposalService.RESOURCE, PROPOSAL)).thenAnswer(inv -> pending);
        created = new EquipmentIntake();
        ReflectionTestUtils.setField(created, "id", 310L);
        when(intakes.createFromPurchase(anyLong(), any(), any(), anyString(), anyLong(), anyString(), any()))
                .thenReturn(created);
    }

    private PurchaseProposalLine line(long id, int lineNo, long catalogId, String name, int planned, String price) {
        EquipmentCatalog catalog = new EquipmentCatalog();
        ReflectionTestUtils.setField(catalog, "id", catalogId);
        catalog.setName(name);
        PurchaseProposalLine line = new PurchaseProposalLine();
        ReflectionTestUtils.setField(line, "id", id);
        line.setProposal(proposal);
        line.setLineNo(lineNo);
        line.setCatalog(catalog);
        line.setName(name);
        line.setUnitName("Bộ");
        line.setQuantity(planned);
        line.setPlannedQuantity(planned);
        line.setPlannedUnitPrice(new BigDecimal(price));
        return line;
    }

    private static IntakePick pick(long lineId, Integer quantity) {
        return new IntakePick(lineId, quantity);
    }

    /** Lập phiếu, trả về các dòng hàng service đưa sang phiếu ghi tăng nháp. */
    private List<PurchasedItem> createIntake(IntakePick... picks) {
        EquipmentIntake result = service.createIntake(PROPOSAL, picks.length == 0 ? null : Arrays.asList(picks));
        assertThat(result).isSameAs(created);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PurchasedItem>> items = ArgumentCaptor.forClass(List.class);
        verify(intakes).createFromPurchase(eq(SCHOOL), eq(FundingSource.STATE_BUDGET), items.capture(),
                eq("Nhập hàng mua theo đề xuất " + CODE), eq(PROPOSAL), eq(CODE), eq(SO_NAME));
        verify(repository).persist(proposal);
        return items.getValue();
    }

    private void assertRefused(List<IntakePick> picks, String message) {
        assertThatThrownBy(() -> service.createIntake(PROPOSAL, picks)).isInstanceOf(FieldValidationException.class)
                .hasMessage(message);
        verify(intakes, never()).createFromPurchase(anyLong(), any(), any(), any(), any(), any(), any());
        verify(repository, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: hàng về đủ, không chọn dòng → phiếu ghi tăng nháp 3 dòng 8 / 3 / 38 bộ, đề xuất nhớ phiếu 310")
    void utcid01() {
        List<PurchasedItem> items = createIntake();
        assertThat(items).extracting(PurchasedItem::catalogId).containsExactly(BOARD, CONIC, STATS);
        assertThat(items).extracting(PurchasedItem::quantity).containsExactly(8, 3, 38);
        assertThat(items.get(2).name()).isEqualTo(STATS_NAME);
        assertThat(items.get(2).unitPrice()).isEqualByComparingTo("111111");
        assertThat(proposal.getIntakeId()).isEqualTo(310L);
    }

    @Test
    @DisplayName("UTCID02 - N: hàng về đợt 1, chọn dòng 543 nhập 5 bộ → phiếu 1 dòng Bộ thiết bị để vẽ trên bảng 5 bộ")
    void utcid02() {
        List<PurchasedItem> items = createIntake(pick(543L, 5));
        assertThat(items).singleElement().satisfies(i -> {
            assertThat(i.catalogId()).isEqualTo(BOARD);
            assertThat(i.quantity()).isEqualTo(5);
        });
    }

    @Test
    @DisplayName("UTCID03 - B: chọn dòng 545 nhập đúng 38 bộ còn lại → lập được")
    void utcid03() {
        assertThat(createIntake(pick(545L, 38))).singleElement()
                .satisfies(i -> assertThat(i.quantity()).isEqualTo(38));
    }

    @Test
    @DisplayName("UTCID04 - B: chọn dòng 545 nhập 39 bộ, quá số còn lại 38 → \"chỉ còn 38 chưa nhập\"")
    void utcid04() {
        assertRefused(List.of(pick(545L, 39)), "\"" + STATS_NAME + "\" chỉ còn 38 chưa nhập");
    }

    @Test
    @DisplayName("UTCID05 - B: chọn dòng 543 với số lượng 0 → \"Chọn ít nhất một thiết bị để nhập\"")
    void utcid05() {
        assertRefused(List.of(pick(543L, 0)), "Chọn ít nhất một thiết bị để nhập");
    }

    @Test
    @DisplayName("UTCID06 - N: chọn dòng 544, không ghi số lượng → nhập hết phần còn lại 3 bộ")
    void utcid06() {
        assertThat(createIntake(pick(544L, null))).singleElement().satisfies(i -> {
            assertThat(i.catalogId()).isEqualTo(CONIC);
            assertThat(i.quantity()).isEqualTo(3);
        });
    }

    @Test
    @DisplayName("UTCID07 - A: chọn dòng 650 (Bảng nhóm, của đề xuất MS-79000805-26-0001) → \"Dòng không thuộc đề xuất này\"")
    void utcid07() {
        assertRefused(List.of(pick(650L, 1)), "Dòng không thuộc đề xuất này");
    }

    @Test
    @DisplayName("UTCID08 - A: đề xuất mới Đã duyệt, chưa vào kế hoạch được duyệt → không lập phiếu ghi tăng được")
    void utcid08() {
        proposal.setStatus(VoucherStatus.APPROVED);
        assertRefused(null, "Chỉ lập phiếu ghi tăng cho đề xuất đã vào kế hoạch được duyệt");
    }

    @Test
    @DisplayName("UTCID09 - A: phiếu NK-79000786-26-0001 đã nhập đủ 8 / 3 / 38 bộ → \"Đề xuất này đã nhập đủ hàng\"")
    void utcid09() {
        received.putAll(Map.of(BOARD, 8, CONIC, 3, STATS, 38));
        assertRefused(null, "Đề xuất này đã nhập đủ hàng");
    }

    @Test
    @DisplayName("UTCID10 - N: đợt trước đã nhập 5 / 8 bộ Bộ thiết bị để vẽ trên bảng → đợt này 3 / 3 / 38 bộ")
    void utcid10() {
        received.put(BOARD, 5);
        assertThat(createIntake()).extracting(PurchasedItem::quantity).containsExactly(3, 3, 38);
    }

    @Test
    @DisplayName("UTCID11 - A: Sở để 0 ở mọi dòng của đề xuất → \"không có gì để nhập\"")
    void utcid11() {
        for (PurchaseProposalLine l : List.of(board, conic, stats)) {
            l.setPlannedQuantity(0);
        }
        assertRefused(null, "Kế hoạch không đưa thiết bị nào của đề xuất này vào mua — không có gì để nhập");
    }

    @Test
    @DisplayName("UTCID12 - N: đề xuất đã có phiếu 310, lập phiếu đợt 2 (id 311) → đề xuất vẫn nhớ phiếu đầu 310")
    void utcid12() {
        proposal.setIntakeId(310L);
        received.put(BOARD, 8);
        ReflectionTestUtils.setField(created, "id", 311L);
        assertThat(createIntake()).extracting(PurchasedItem::catalogId).containsExactly(CONIC, STATS);
        assertThat(proposal.getIntakeId()).isEqualTo(310L);
    }

    @Test
    @DisplayName("UTCID13 - B: phiếu nháp khác đang giữ 38 bộ Thống kê và Xác suất, chọn dòng 545 nhập 1 → \"chỉ còn 0 chưa nhập\"")
    void utcid13() {
        received.put(STATS, 38);
        pending.put(STATS, 38);
        assertRefused(List.of(pick(545L, 1)), "\"" + STATS_NAME + "\" chỉ còn 0 chưa nhập");
    }

    @Test
    @DisplayName("UTCID14 - A: hiệu trưởng THPT An Lạc Lê Bảo Nam lập phiếu cho đề xuất của THPT An Nghĩa → không tìm thấy đề xuất")
    void utcid14() {
        when(principals.current()).thenReturn(Optional.of(
                new RowLevelPrincipal(277L, 1527L, null, null, Set.of("SCHOOL_LEADER"), Set.of())));
        when(repository.findOne(Mockito.<Specification<PurchaseProposal>>any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.createIntake(PROPOSAL, null)).isInstanceOf(ResourceNotFoundException.class);
        verify(intakes, never()).createFromPurchase(anyLong(), any(), any(), any(), any(), any(), any());
    }
}
