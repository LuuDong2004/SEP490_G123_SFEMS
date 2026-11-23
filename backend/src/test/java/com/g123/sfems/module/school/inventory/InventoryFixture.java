package com.g123.sfems.module.school.inventory;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_MOCKS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.equipment.EquipmentLifecycle;
import com.g123.sfems.module.school.equipment.EquipmentService;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.facility.RoomService;
import com.g123.sfems.module.school.voucher.DocumentNumberService;
import com.g123.sfems.module.school.voucher.InventoryFreeze;
import com.g123.sfems.module.school.voucher.VoucherCampus;
import com.g123.sfems.module.school.voucher.VoucherEventRepository;
import com.g123.sfems.module.school.voucher.VoucherForms;
import com.g123.sfems.module.school.voucher.VoucherServiceDeps;
import com.g123.sfems.module.school.voucher.VoucherWorkflow;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.module.system.approvalflow.ApprovalFlowService;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Dựng {@link InventoryCampaignService} và {@link InventorySessionService} với phụ thuộc là mock — riêng
 * {@link VoucherWorkflow} chạy thật (trên mock) để câu báo lỗi và nhật ký duyệt là của code thật.
 *
 * <p>Dữ liệu: Sở 10, trường 1 (thuộc Sở 10), trường 2; phòng 101 (Phòng Tin 1), 102 (Phòng Tin 2) của trường 1, phòng
 * 201 của trường 2; thiết bị TB-001 … TB-005 (Máy chiếu, theo từng cái) và lô NaCl 500 g (theo số lượng).
 */
class InventoryFixture {

    // ----------------------------------------------------------------- phụ thuộc
    final InventorySessionRepository sessions = mock(InventorySessionRepository.class);
    final InventoryCampaignRepository campaignRepository = mock(InventoryCampaignRepository.class);
    final RowLevelSecurity rowLevel = mock(RowLevelSecurity.class, RETURNS_MOCKS);
    final SchoolService schools = mock(SchoolService.class);
    final RowLevelPrincipalResolver principals = mock(RowLevelPrincipalResolver.class);
    final EntityManager entityManager = mock(EntityManager.class);
    final VoucherForms forms = mock(VoucherForms.class);
    final VoucherCampus campus = mock(VoucherCampus.class, RETURNS_MOCKS);
    final EquipmentService equipment = mock(EquipmentService.class);
    final RoomService rooms = mock(RoomService.class);
    final EquipmentCatalogService catalogs = mock(EquipmentCatalogService.class);
    final EquipmentLifecycle lifecycle = mock(EquipmentLifecycle.class);
    final InventoryCampaignService campaigns = mock(InventoryCampaignService.class);
    final ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final CampusScope campusScope = mock(CampusScope.class);
    final DepartmentOfEducationService bodies = mock(DepartmentOfEducationService.class);

    final VoucherEventRepository events = mock(VoucherEventRepository.class);
    final DocumentNumberService numbers = mock(DocumentNumberService.class);
    final ManagedSchoolsCache managedSchools = mock(ManagedSchoolsCache.class);
    final ApprovalFlowService approvalFlows = mock(ApprovalFlowService.class);
    final JdbcTemplate freezeJdbc = mock(JdbcTemplate.class);

    final VoucherWorkflow workflow = new VoucherWorkflow(events, numbers, principals, managedSchools,
            mock(JdbcTemplate.class), approvalFlows, publisher, new InventoryFreeze(freezeJdbc));

    final InventorySessionService sessionService = new InventorySessionService(
            new VoucherServiceDeps(rowLevel, workflow, schools, principals, entityManager, forms, campus), sessions,
            equipment, rooms, catalogs, lifecycle, campaigns, publisher, jdbc);

    final InventoryCampaignService campaignService = new InventoryCampaignService(campaignRepository, sessions,
            principals, bodies, managedSchools, rowLevel, jdbc, publisher, campus);

    // ----------------------------------------------------------------- dữ liệu
    final DepartmentOfEducation so10 = body(10L, "Sở GD&ĐT", ManagingBodyType.SO);
    final School school1 = school(1L, "Trường THPT số 1", so10);
    final School school2 = school(2L, "Trường THPT số 2", so10);
    final Room room101 = room(101L, "Phòng Tin 1", school1);
    final Room room102 = room(102L, "Phòng Tin 2", school1);
    final Room room201 = room(201L, "Phòng Lý", school2);
    final EquipmentCatalog projector = catalog(1L, "Máy chiếu", TrackingType.SERIAL);
    final EquipmentCatalog nacl = catalog(2L, "NaCl", TrackingType.BULK);

    InventoryFixture() {
        sessionService.setCampusScope(campusScope);
        when(campusScope.pinnedCampusIn(anyLong())).thenReturn(null);
        when(schools.get(1L)).thenReturn(school1);
        when(schools.get(2L)).thenReturn(school2);
        for (Room room : List.of(room101, room102, room201)) {
            when(rooms.getAcrossCampuses(room.getId())).thenReturn(room);
        }
        when(catalogs.get(1L)).thenReturn(projector);
        when(sessions.persist(any())).thenAnswer(inv -> inv.getArgument(0));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(numbers.reserve(any(), eq("KK"), any())).thenReturn("KK-2026-00001");
        when(approvalFlows.chainOf(any())).thenReturn(List.of(ApprovalStep.SCHOOL));
        when(bodies.get(10L)).thenReturn(so10);
        when(rowLevel.asSystem(anyString(), Mockito.<Supplier<Object>>any()))
                .thenAnswer(inv -> ((Supplier<?>) inv.getArgument(1)).get());
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

    void soSpecialist() {
        signedInAs(null, 10L, "CHUYEN_VIEN_SO");
    }

    void admin() {
        signedInAs(null, null, "ADMIN");
    }

    // ----------------------------------------------------------------- biên bản dựng sẵn
    /** Biên bản id 20 của trường 1, kiểm cả trường, đã có tổ kiểm kê. */
    InventorySession session(VoucherStatus status, InventoryLine... lines) {
        InventorySession session = new InventorySession();
        ReflectionTestUtils.setField(session, "id", 20L);
        session.setSchool(school1);
        session.setStatus(status);
        session.setTitle("Kiểm kê cuối năm 2026");
        session.setInventoryDate(LocalDate.of(2026, 11, 25));
        session.setCouncil("Nguyễn Văn A, Trần Thị B");
        session.setApprovalStep(status == VoucherStatus.PENDING ? ApprovalStep.SCHOOL : null);
        session.setSubmittedById(status == VoucherStatus.DRAFT ? null : 100L);
        session.replaceLines(new ArrayList<>(List.of(lines)));
        when(sessions.findOne(Mockito.<Specification<InventorySession>>any())).thenReturn(Optional.of(session));
        return session;
    }

    Equipment item(long id, String code, EquipmentCatalog catalog, Room room, EquipmentCondition condition,
            AssetStatus status) {
        Equipment item = new Equipment();
        ReflectionTestUtils.setField(item, "id", id);
        item.setCode(code);
        item.setName(catalog.getName());
        item.setSchool(school1);
        item.setCatalog(catalog);
        item.setRoom(room);
        item.setCondition(condition);
        item.setStatus(status);
        return item;
    }

    /** Thiết bị theo sổ: Máy chiếu ở P101, Tốt, Đang sử dụng. */
    Equipment projectorItem(long id, String code) {
        return item(id, code, projector, room101, EquipmentCondition.TOT, AssetStatus.IN_USE);
    }

    /** Lô NaCl 500 g trong kho (phòng = null). */
    Equipment naclLot() {
        Equipment lot = item(13L, "79.JP.00.HL.26.001", nacl, null, EquipmentCondition.TOT, AssetStatus.IN_STOCK);
        lot.setQuantity(new BigDecimal("500"));
        return lot;
    }

    /** Một dòng kiểm đếm, phòng / tình trạng theo sổ lấy từ thiết bị. */
    static InventoryLine line(long id, int lineNo, Equipment item) {
        InventoryLine line = new InventoryLine();
        ReflectionTestUtils.setField(line, "id", id);
        line.setLineNo(lineNo);
        line.setEquipment(item);
        line.setExpectedRoom(item.getRoom());
        line.setExpectedCondition(item.getCondition());
        if (item.getCatalog().getTrackingType() == TrackingType.BULK) {
            line.setExpectedQuantity(item.getQuantity());
        }
        return line;
    }

    /** Dòng đã kiểm: thấy hay không, ở đâu, tình trạng gì. */
    static InventoryLine counted(InventoryLine line, Boolean found, Room foundRoom, EquipmentCondition condition) {
        line.setFound(found);
        line.setFoundRoom(foundRoom);
        line.setFoundCondition(condition);
        return line;
    }

    List<VoucherEvent> recordedEvents() {
        ArgumentCaptor<VoucherEvent> captor = ArgumentCaptor.forClass(VoucherEvent.class);
        Mockito.verify(events, Mockito.atLeast(0)).save(captor.capture());
        return captor.getAllValues();
    }

    List<Object> publishedEvents() {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        Mockito.verify(publisher, Mockito.atLeast(0)).publishEvent(captor.capture());
        return captor.getAllValues();
    }

    // ----------------------------------------------------------------- dựng entity
    static DepartmentOfEducation body(Long id, String name, ManagingBodyType type) {
        DepartmentOfEducation body = new DepartmentOfEducation("SO" + id, name, type);
        ReflectionTestUtils.setField(body, "id", id);
        return body;
    }

    static School school(Long id, String name, DepartmentOfEducation body) {
        School school = new School(body, "TRUONG" + id, name);
        ReflectionTestUtils.setField(school, "id", id);
        return school;
    }

    static Room room(Long id, String name, School school) {
        Room room = new Room();
        ReflectionTestUtils.setField(room, "id", id);
        room.setName(name);
        room.setSchool(school);
        room.setActive(true);
        return room;
    }

    static EquipmentCatalog catalog(Long id, String name, TrackingType tracking) {
        EquipmentCatalog catalog = new EquipmentCatalog();
        ReflectionTestUtils.setField(catalog, "id", id);
        catalog.setName(name);
        catalog.setTrackingType(tracking);
        return catalog;
    }
}
