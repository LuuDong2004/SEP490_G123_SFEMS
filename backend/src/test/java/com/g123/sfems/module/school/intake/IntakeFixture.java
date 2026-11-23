package com.g123.sfems.module.school.intake;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_MOCKS;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.acquisitionmethod.AcquisitionMethodService;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.catalog.originsource.OriginSourceService;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.equipment.EquipmentService;
import com.g123.sfems.module.school.facility.RoomService;
import com.g123.sfems.module.school.voucher.DocumentNumberService;
import com.g123.sfems.module.school.voucher.InventoryFreeze;
import com.g123.sfems.module.school.voucher.VoucherCampus;
import com.g123.sfems.module.school.voucher.VoucherEventRepository;
import com.g123.sfems.module.school.voucher.VoucherForms;
import com.g123.sfems.module.school.voucher.VoucherWorkflow;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.module.system.approvalflow.ApprovalFlowService;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Dựng {@link EquipmentIntakeService} với mọi phụ thuộc là mock — trừ {@link VoucherWorkflow} và
 * {@link InventoryFreeze}: hai lớp này chạy thật (trên mock) để câu báo lỗi và nhật ký duyệt là của code thật.
 *
 * <p>Dữ liệu dùng chung cho các test case trong sheet unit_test.xlsx: trường 1 (thuộc Sở 10), trường 2, phòng 101
 * (Phòng Tin 1), phòng 102 (Phòng Tin 2, ngừng sử dụng), phòng 201 (trường 2), kho id 100; nhóm thiết bị id 1 Máy chiếu
 * (theo từng cái) và id 2 NaCl (hoá chất theo số lượng).
 */
class IntakeFixture {

    static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    static final LocalDate TODAY = LocalDate.now(VIETNAM);

    // ----------------------------------------------------------------- phụ thuộc
    final EquipmentIntakeRepository repository = mock(EquipmentIntakeRepository.class);
    final RowLevelSecurity rowLevel = mock(RowLevelSecurity.class, RETURNS_MOCKS);
    final SchoolService schools = mock(SchoolService.class);
    final RowLevelPrincipalResolver principals = mock(RowLevelPrincipalResolver.class);
    final EquipmentCatalogService catalogs = mock(EquipmentCatalogService.class);
    final RoomService rooms = mock(RoomService.class);
    final OriginSourceService originSources = mock(OriginSourceService.class);
    final AcquisitionMethodService acquisitionMethods = mock(AcquisitionMethodService.class);
    final EquipmentService equipment = mock(EquipmentService.class);
    final EntityManager entityManager = mock(EntityManager.class);
    final VoucherForms forms = mock(VoucherForms.class);
    final SchoolYearService schoolYears = mock(SchoolYearService.class);
    final VoucherCampus campus = mock(VoucherCampus.class, RETURNS_MOCKS);

    final VoucherEventRepository events = mock(VoucherEventRepository.class);
    final DocumentNumberService numbers = mock(DocumentNumberService.class);
    final ManagedSchoolsCache managedSchools = mock(ManagedSchoolsCache.class);
    final JdbcTemplate workflowJdbc = mock(JdbcTemplate.class);
    final ApprovalFlowService approvalFlows = mock(ApprovalFlowService.class);
    final ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
    final JdbcTemplate freezeJdbc = mock(JdbcTemplate.class);

    final VoucherWorkflow workflow = new VoucherWorkflow(events, numbers, principals, managedSchools, workflowJdbc,
            approvalFlows, publisher, new InventoryFreeze(freezeJdbc));

    final EquipmentIntakeService service = new EquipmentIntakeService(repository, rowLevel, schools, principals,
            catalogs, rooms, originSources, acquisitionMethods, equipment, workflow, entityManager, forms, schoolYears,
            campus);

    // ----------------------------------------------------------------- dữ liệu
    final School school1 = school(1L, "Trường THPT số 1");
    final School school2 = school(2L, "Trường THPT số 2");
    final Room room101 = room(101L, "Phòng Tin 1", school1, true);
    final Room room102 = room(102L, "Phòng Tin 2", school1, false);
    final Room room201 = room(201L, "Phòng Lý", school2, true);
    final Room storeroom = room(100L, "Kho thiết bị", school1, true);
    final EquipmentCatalog projector = catalog(1L, "Máy chiếu", TrackingType.SERIAL, AssetCategory.FIXED_ASSET);
    final EquipmentCatalog nacl = catalog(2L, "NaCl", TrackingType.BULK, AssetCategory.CHEMICAL);
    final SchoolYear schoolYear = new SchoolYear();
    final Map<OriginRule, OriginSource> origins = new HashMap<>();

    /** Số tệp đính kèm mà truy vấn Attachment trả về. */
    long attachments = 1;

    IntakeFixture() {
        schoolYear.setCode("2026-2027");
        schoolYear.setName("2026 - 2027");
        long id = 1;
        for (OriginRule rule : OriginRule.values()) {
            OriginSource origin = new OriginSource();
            ReflectionTestUtils.setField(origin, "id", id++);
            origin.setCode(rule.name());
            origin.setName(rule.label());
            origins.put(rule, origin);
            when(originSources.get(origin.getId())).thenReturn(origin);
            when(originSources.of(rule)).thenReturn(origin);
        }
        when(schools.get(1L)).thenReturn(school1);
        when(schools.get(2L)).thenReturn(school2);
        when(catalogs.get(1L)).thenReturn(projector);
        when(catalogs.get(2L)).thenReturn(nacl);
        for (Room room : List.of(room101, room102, room201, storeroom)) {
            when(rooms.getAcrossCampuses(room.getId())).thenReturn(room);
        }
        when(rooms.storeroomOf(1L)).thenReturn(storeroom);
        when(schoolYears.forDate(any())).thenReturn(schoolYear);
        when(campus.pinnedCampus()).thenReturn(null);
        when(repository.persist(any())).thenAnswer(inv -> inv.getArgument(0));
        when(numbers.reserve(any(), eq("NK"), any())).thenReturn("NK-2026-00001");
        when(approvalFlows.chainOf(any())).thenReturn(List.of(ApprovalStep.SCHOOL));
        @SuppressWarnings("unchecked")
        TypedQuery<Long> count = mock(TypedQuery.class, RETURNS_SELF);
        when(count.getSingleResult()).thenAnswer(inv -> attachments);
        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(count);
    }

    // ----------------------------------------------------------------- tài khoản
    void signedInAs(Long schoolId, Long managingBodyId, String role) {
        when(principals.current()).thenReturn(Optional.of(
                new RowLevelPrincipal(100L, schoolId, managingBodyId, null, Set.of(role), Set.of())));
    }

    void officerOfSchool1() {
        signedInAs(1L, null, "CAN_BO_THIET_BI");
    }

    void leaderOfSchool(long schoolId) {
        signedInAs(schoolId, null, "HIEU_TRUONG");
    }

    void admin() {
        signedInAs(null, null, "ADMIN");
    }

    void soAccount() {
        signedInAs(null, 10L, "CHUYEN_VIEN_SO");
    }

    // ----------------------------------------------------------------- phiếu dựng sẵn
    OriginSource origin(OriginRule rule) {
        return origins.get(rule);
    }

    IdRef originRef(OriginRule rule) {
        return new IdRef(origin(rule).getId());
    }

    /** Phiếu id 10 của trường 1: nguồn Trường tự mua sắm, đủ hoá đơn, 1 dòng Máy chiếu 5 / 5 ở phòng 101. */
    EquipmentIntake intake(VoucherStatus status) {
        EquipmentIntake intake = new EquipmentIntake();
        ReflectionTestUtils.setField(intake, "id", 10L);
        intake.setSchool(school1);
        intake.setStatus(status);
        intake.setIntakeDate(TODAY);
        intake.setSchoolYear(schoolYear);
        intake.setOriginSource(origin(OriginRule.MUA_NGOAI_KH));
        intake.setSupplier("Công ty ABC");
        intake.setDocumentNo("HD-0012");
        intake.setDocumentDate(TODAY.minusDays(3));
        intake.setFundingSource(FundingSource.STATE_BUDGET);
        intake.setSubmittedById(status == VoucherStatus.DRAFT ? null : 100L);
        intake.setApprovalStep(status == VoucherStatus.PENDING ? ApprovalStep.SCHOOL : null);
        List<EquipmentIntakeLine> lines = new ArrayList<>();
        lines.add(line(intake, projector, 5, 5, room101, new BigDecimal("12000000")));
        intake.replaceLines(lines);
        return intake;
    }

    EquipmentIntakeLine line(EquipmentIntake intake, EquipmentCatalog catalog, int documentQty, int receivedQty,
            Room room, BigDecimal unitPrice) {
        EquipmentIntakeLine line = new EquipmentIntakeLine();
        line.setIntake(intake);
        line.setLineNo(1);
        line.setCatalog(catalog);
        line.setName(catalog.getName());
        line.setPhysicalOrDigital(PhysicalDigitalType.PHYSICAL);
        line.setDocumentQuantity(documentQty);
        line.setReceivedQuantity(receivedQty);
        line.setRoom(room);
        line.setUnitPrice(unitPrice);
        return line;
    }

    /** Thay toàn bộ dòng của phiếu bằng một dòng. */
    EquipmentIntakeLine onlyLine(EquipmentIntake intake, EquipmentIntakeLine line) {
        intake.replaceLines(new ArrayList<>(List.of(line)));
        return line;
    }

    /** Phiếu được repository trả về khi service đọc theo id (phạm vi đọc / ghi / xoá). */
    void stored(EquipmentIntake intake) {
        when(repository.findOne(org.mockito.ArgumentMatchers.<org.springframework.data.jpa.domain.Specification<EquipmentIntake>>any())).thenReturn(Optional.ofNullable(intake));
    }

    /** Có phiếu kiểm kê đang mở chạm tới phiếu: InventoryFreeze nhận dòng này từ CSDL. */
    void frozenBy(String code, String room) {
        Map<String, Object> row = new HashMap<>();
        row.put("code", code);
        row.put("title", "Kiểm kê");
        row.put("room", room);
        row.put("campus", null);
        when(freezeJdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(row));
    }

    /** Các sự việc đã ghi vào nhật ký duyệt (voucher_events). */
    List<VoucherEvent> recordedEvents() {
        ArgumentCaptor<VoucherEvent> captor = ArgumentCaptor.forClass(VoucherEvent.class);
        org.mockito.Mockito.verify(events, org.mockito.Mockito.atLeast(0)).save(captor.capture());
        return captor.getAllValues();
    }

    /** Các sự kiện đã publish (thông báo), dạng chuỗi — các record sự kiện là package-private. */
    List<String> publishedEvents() {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        org.mockito.Mockito.verify(publisher, org.mockito.Mockito.atLeast(0)).publishEvent(captor.capture());
        return captor.getAllValues().stream().map(String::valueOf).toList();
    }

    // ----------------------------------------------------------------- dựng entity
    static School school(Long id, String name) {
        School school = new School(null, "TRUONG" + id, name);
        ReflectionTestUtils.setField(school, "id", id);
        return school;
    }

    static Room room(Long id, String name, School school, boolean active) {
        Room room = new Room();
        ReflectionTestUtils.setField(room, "id", id);
        room.setName(name);
        room.setSchool(school);
        room.setActive(active);
        return room;
    }

    static EquipmentCatalog catalog(Long id, String name, TrackingType tracking, AssetCategory category) {
        EquipmentCatalog catalog = new EquipmentCatalog();
        ReflectionTestUtils.setField(catalog, "id", id);
        catalog.setName(name);
        catalog.setTrackingType(tracking);
        catalog.setAssetCategory(category);
        Unit unit = new Unit();
        unit.setName(tracking == TrackingType.BULK ? "g" : "cái");
        catalog.setUnit(unit);
        return catalog;
    }
}
