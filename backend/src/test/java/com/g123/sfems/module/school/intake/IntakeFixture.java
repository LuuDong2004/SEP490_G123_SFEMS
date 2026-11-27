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
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
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
 * <p>Dữ liệu lấy từ CSDL đang chạy của dự án (bản sao lưu sfems_20261127-1350), dùng chung cho unit_test_v5.xlsx:
 * <ul>
 *   <li>THPT An Nghĩa (id 1503, mã 79000786, mã EMIS hai ký tự D2) và THPT An Lạc (id 1527, mã 79000805), thuộc Sở
 *   Giáo dục và Đào tạo Thành phố Hồ Chí Minh (id 1, SGD-HCM);</li>
 *   <li>phòng của THPT An Nghĩa: 1090 Phòng thiết bị giáo dục (C.104), 1105 Nhà kho (D.107), 1088 Phòng Tin học 2
 *   (C.102, test đặt ngừng sử dụng); phòng 985 (Phòng học A.101) là của THPT An Lạc — tài khoản THPT An Nghĩa không
 *   đọc được;</li>
 *   <li>nhóm thiết bị 1160 THPT-00-013 Máy chiếu (hoặc Màn hình hiển thị), đơn vị Bộ, theo từng cái; 1364 THPT-12-092
 *   Sodium chloride (NaCl), đơn vị Gam, hoá chất theo số lượng;</li>
 *   <li>nguồn hình thành theo bảng origin_sources: 6 Khác, 7 Kế hoạch mua sắm, 8 Được tặng, tài trợ, 9 Đơn vị tự làm,
 *   10 Được cấp phát, bàn giao, 11 Kiểm kê thừa, 12 Trường tự mua sắm;</li>
 *   <li>tài khoản: 79000786.nghiavn ({@link #OFFICER}, SCHOOL_STAFF, user id 289), 79000786.tunt01 ({@link #PRINCIPAL},
 *   SCHOOL_LEADER, id 288), 79000805.hieutruong ({@link #PRINCIPAL_2}, SCHOOL_LEADER của THPT An Lạc, id 277);</li>
 *   <li>biên bản kiểm kê id 84 của THPT An Nghĩa (đợt "Kiểm kê toàn địa bàn năm học 2026-2027"), số khi trình
 *   {@link #SESSION_CODE}.</li>
 * </ul>
 */
class IntakeFixture {

    static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    static final LocalDate TODAY = LocalDate.now(VIETNAM);

    static final long SCHOOL = 1503L;
    static final long OTHER_SCHOOL = 1527L;
    static final long ROOM_101 = 1090L;
    static final long ROOM_CLOSED = 1088L;
    static final long OTHER_SCHOOL_ROOM = 985L;
    static final long STOREROOM = 1105L;
    static final long PROJECTOR = 1160L;
    static final long NACL = 1364L;
    static final long OFFICER_ID = 289L;
    static final long PRINCIPAL_ID = 288L;
    static final long PRINCIPAL_2_ID = 277L;
    static final long SESSION_ID = 84L;
    static final String SESSION_CODE = "KK-79000786-26-0001";

    static final String OFFICER = "Nguyễn Vũ Nghĩa";
    static final String PRINCIPAL = "Trần Ngọc Tú";
    static final String PRINCIPAL_2 = "Lê Bảo Nam";
    static final String SUPPLIER = "Công ty TNHH Thiết bị Giáo dục Hồng Hà";
    static final String PROJECTOR_NAME = "Máy chiếu (hoặc Màn hình hiển thị)";
    static final String NACL_NAME = "Sodium chloride (NaCl)";

    /** Mã hiển thị thật của nguồn hình thành (bảng origin_sources, cột code). */
    static final Map<String, String> ORIGIN_CODES = Map.of("MUA_SAM", "NG001", "MUA_NGOAI_KH", "NG002", "PHAN_BO", "NG003",
            "TANG_TAI_TRO", "NG004", "KIEM_KE_THUA", "NG005", "TU_LAM", "NG006", "KHAC", "NG007");

    /** Id thật của nguồn hình thành (bảng origin_sources). */
    static final Map<String, Long> ORIGIN_IDS = Map.of("KHAC", 6L, "MUA_SAM", 7L, "TANG_TAI_TRO", 8L, "TU_LAM", 9L,
            "PHAN_BO", 10L, "KIEM_KE_THUA", 11L, "MUA_NGOAI_KH", 12L);

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
            approvalFlows, publisher, new InventoryFreeze(freezeJdbc), campus);

    final EquipmentIntakeService service = new EquipmentIntakeService(repository, rowLevel, schools, principals,
            catalogs, rooms, originSources, acquisitionMethods, equipment, workflow, entityManager, forms, schoolYears,
            campus);

    // ----------------------------------------------------------------- dữ liệu
    final School school1 = school(SCHOOL, "79000786", "THPT An Nghĩa");
    final School school2 = school(OTHER_SCHOOL, "79000805", "THPT An Lạc");
    final Room room101 = room(ROOM_101, "Phòng thiết bị giáo dục", school1, true);
    final Room roomClosed = room(ROOM_CLOSED, "Phòng Tin học 2", school1, false);
    final Room storeroom = room(STOREROOM, "Nhà kho", school1, true);
    final EquipmentCatalog projector = catalog(PROJECTOR, PROJECTOR_NAME, TrackingType.SERIAL, AssetCategory.FIXED_ASSET,
            "Bộ");
    final EquipmentCatalog nacl = catalog(NACL, NACL_NAME, TrackingType.BULK, AssetCategory.CHEMICAL, "Gam");
    final SchoolYear schoolYear = new SchoolYear();
    final Map<OriginRule, OriginSource> origins = new HashMap<>();

    /** Số tệp đính kèm mà truy vấn Attachment trả về. */
    long attachments = 1;

    IntakeFixture() {
        ReflectionTestUtils.setField(schoolYear, "id", 4L);
        schoolYear.setCode("NH006");
        schoolYear.setName("Năm học 2026-2027");
        for (OriginRule rule : OriginRule.values()) {
            OriginSource origin = new OriginSource();
            ReflectionTestUtils.setField(origin, "id", ORIGIN_IDS.getOrDefault(rule.name(), 100L + rule.ordinal()));
            // Mã hiển thị NG001… và khoá hệ thống (= tên luật) như bảng origin_sources (changelog 314).
            origin.setCode(ORIGIN_CODES.get(rule.name()));
            origin.setSystemKey(rule.name());
            origin.setName(rule.label());
            origins.put(rule, origin);
            when(originSources.get(origin.getId())).thenReturn(origin);
            when(originSources.of(rule)).thenReturn(origin);
        }
        when(schools.get(SCHOOL)).thenReturn(school1);
        when(schools.get(OTHER_SCHOOL)).thenReturn(school2);
        when(catalogs.get(PROJECTOR)).thenReturn(projector);
        when(catalogs.get(NACL)).thenReturn(nacl);
        for (Room room : List.of(room101, roomClosed, storeroom)) {
            when(rooms.getAcrossCampuses(room.getId())).thenReturn(room);
        }
        // Phòng của trường khác: ứng dụng thật không đọc được (phạm vi dữ liệu) — 404 "Không tìm thấy phòng".
        when(rooms.getAcrossCampuses(OTHER_SCHOOL_ROOM))
                .thenThrow(new ResourceNotFoundException("Room", OTHER_SCHOOL_ROOM));
        when(rooms.storeroomOf(SCHOOL)).thenReturn(storeroom);
        when(schoolYears.forDate(any())).thenReturn(schoolYear);
        when(campus.pinnedCampus()).thenReturn(null);
        when(repository.persist(any())).thenAnswer(inv -> inv.getArgument(0));
        when(numbers.reserve(any(), eq("NK"), any())).thenReturn("NK-79000786-26-0002");
        when(approvalFlows.chainOf(any())).thenReturn(List.of(ApprovalStep.SCHOOL));
        @SuppressWarnings("unchecked")
        TypedQuery<Long> count = mock(TypedQuery.class, RETURNS_SELF);
        when(count.getSingleResult()).thenAnswer(inv -> attachments);
        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(count);
    }

    // ----------------------------------------------------------------- tài khoản (vai trò thật: bảng roles)
    void signedInAs(long userId, Long schoolId, Long managingBodyId, String role) {
        when(principals.current()).thenReturn(Optional.of(
                new RowLevelPrincipal(userId, schoolId, managingBodyId, null, Set.of(role), Set.of())));
    }

    /** 79000786.nghiavn — Nguyễn Vũ Nghĩa, cán bộ thiết bị THPT An Nghĩa. */
    void officerOfSchool1() {
        signedInAs(OFFICER_ID, SCHOOL, null, "SCHOOL_STAFF");
    }

    /** 79000786.tunt01 — Trần Ngọc Tú (id 288, THPT An Nghĩa) hoặc 79000805.hieutruong — Lê Bảo Nam (id 277, THPT An Lạc). */
    void leaderOfSchool(long schoolId) {
        signedInAs(schoolId == SCHOOL ? PRINCIPAL_ID : PRINCIPAL_2_ID, schoolId, null, "SCHOOL_LEADER");
    }

    // ----------------------------------------------------------------- phiếu dựng sẵn
    OriginSource origin(OriginRule rule) {
        return origins.get(rule);
    }

    IdRef originRef(OriginRule rule) {
        return new IdRef(origin(rule).getId());
    }

    /** Phiếu id 311 của THPT An Nghĩa: nguồn Trường tự mua sắm, hoá đơn 0001234 của Hồng Hà, 1 dòng Máy chiếu 5 / 5 ở Phòng thiết bị giáo dục, 12.000.000 đ. */
    EquipmentIntake intake(VoucherStatus status) {
        EquipmentIntake intake = new EquipmentIntake();
        ReflectionTestUtils.setField(intake, "id", 311L);
        intake.setSchool(school1);
        intake.setStatus(status);
        intake.setIntakeDate(TODAY);
        intake.setSchoolYear(schoolYear);
        intake.setOriginSource(origin(OriginRule.MUA_NGOAI_KH));
        intake.setSupplier(SUPPLIER);
        intake.setDocumentNo("0001234");
        intake.setDocumentDate(TODAY.minusDays(3));
        intake.setFundingSource(FundingSource.STATE_BUDGET);
        intake.setSubmittedById(status == VoucherStatus.DRAFT ? null : OFFICER_ID);
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

    /**
     * Có phiếu kiểm kê đang mở chạm tới phiếu: InventoryFreeze nhận dòng này từ CSDL. Phiếu kiểm kê nháp chưa có số
     * ({@code code = null}) thì câu báo nêu tên phiếu.
     */
    void frozenBy(String code, String title, String room) {
        Map<String, Object> row = new HashMap<>();
        row.put("code", code);
        row.put("title", title);
        row.put("room", room);
        row.put("campus", null);
        when(freezeJdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(row));
    }

    /**
     * Phiếu lập từ biên bản kiểm kê {@link #SESSION_CODE} (id {@link #SESSION_ID}) của trường, nguồn Kiểm kê thừa:
     * CSDL trả về trạng thái biên bản và số thiết bị thừa biên bản ghi nhận cho thiết bị của dòng 1; chưa phiếu ghi tăng
     * nào khác lập từ biên bản này.
     */
    void fromInventorySession(EquipmentIntake intake, String sessionStatus, int surplus) {
        intake.setOriginSource(origin(OriginRule.KIEM_KE_THUA));
        intake.setSource("inventory_sessions", SESSION_ID, SESSION_CODE);
        Query head = mock(Query.class, RETURNS_SELF);
        when(head.getResultList()).thenReturn(java.util.Collections.<Object>singletonList(new Object[] {SCHOOL, sessionStatus}));
        Query surplusRows = mock(Query.class, RETURNS_SELF);
        Long catalogId = intake.getLines().get(0).getCatalog().getId();
        when(surplusRows.getResultList()).thenReturn(java.util.Collections.<Object>singletonList(new Object[] {catalogId, surplus}));
        when(entityManager.createNativeQuery(org.mockito.ArgumentMatchers.contains("FROM inventory_sessions")))
                .thenReturn(head);
        when(entityManager.createNativeQuery(org.mockito.ArgumentMatchers.contains("FROM inventory_surplus")))
                .thenReturn(surplusRows);
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> others = mock(TypedQuery.class, RETURNS_SELF);
        when(others.getResultList()).thenReturn(List.of());
        when(entityManager.createQuery(anyString(), eq(Object[].class))).thenReturn(others);
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
    static School school(Long id, String code, String name) {
        School school = new School(null, code, name);
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

    static EquipmentCatalog catalog(Long id, String name, TrackingType tracking, AssetCategory category,
            String unitName) {
        EquipmentCatalog catalog = new EquipmentCatalog();
        ReflectionTestUtils.setField(catalog, "id", id);
        catalog.setName(name);
        catalog.setTrackingType(tracking);
        catalog.setAssetCategory(category);
        Unit unit = new Unit();
        unit.setName(unitName);
        catalog.setUnit(unit);
        return catalog;
    }
}
