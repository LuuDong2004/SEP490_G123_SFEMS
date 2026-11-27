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
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.system.notification.service.NotificationService;
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
import org.springframework.jdbc.core.RowMapper;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Dựng {@link InventoryCampaignService} và {@link InventorySessionService} với phụ thuộc là mock — riêng
 * {@link VoucherWorkflow} chạy thật (trên mock) để câu báo lỗi và nhật ký duyệt là của code thật.
 *
 * <p>Dữ liệu lấy từ CSDL đang chạy của dự án (bản sao lưu sfems_20261127-1350), dùng chung cho unit_test_v5.xlsx:
 * <ul>
 *   <li>Sở Giáo dục và Đào tạo Thành phố Hồ Chí Minh (id 1, SGD-HCM); THPT An Nghĩa (id 1503, mã 79000786) và THPT
 *   An Lạc (id 1527, mã 79000805) thuộc Sở;</li>
 *   <li>phòng 1087 Phòng Tin học 1 (C.101), 1088 Phòng Tin học 2 (C.102), 1092 Phòng bộ môn Hóa học (C.202) của An
 *   Nghĩa; phòng 1019 Phòng bộ môn Vật lý (C.201) của An Lạc;</li>
 *   <li>thiết bị 79.D2.14.TB.0001.19 … 79.D2.14.TB.0005.19 (id 24776 … 24780, nhóm 1670 Máy tính để bàn hoặc máy
 *   tính xách tay, theo từng cái, ở Phòng Tin học 1) và lô 79.D2.12.TB.0067.23 Sodium chloride (NaCl) 99 g (id 23792,
 *   nhóm 1364, ở Phòng bộ môn Hóa học);</li>
 *   <li>năm học 2026-2027 (id 4, NH006, từ 05/09/2026, năm sau từ 05/09/2027);</li>
 *   <li>đợt kiểm kê id 20 "Kiểm kê toàn địa bàn năm học 2026-2027" của Sở (hiệu lực 26/11/2026, kết thúc
 *   31/12/2026); biên bản id 84 của THPT An Nghĩa trong đợt đó;</li>
 *   <li>tài khoản: {@link #OFFICER} (79000786.nghiavn, id 289) cán bộ thiết bị, {@link #PRINCIPAL} (79000786.tunt01,
 *   id 288) hiệu trưởng THPT An Nghĩa, {@link #OTHER_PRINCIPAL} (79000805.hieutruong, id 277) hiệu trưởng THPT An Lạc,
 *   {@link #OTHER_OFFICER} (79000805.cbtb, id 278) cán bộ thiết bị THPT An Lạc, {@link #SO_SPECIALIST} (donglv2,
 *   id 130) chuyên viên Sở, {@link #SO_LEADER} (donglv, id 129) lãnh đạo Sở, {@link #ADMIN} (admin, id 1) quản trị
 *   viên; tổ kiểm kê {@link #COUNCIL} (tổ kiểm kê của biên bản 84).</li>
 * </ul>
 */
class InventoryFixture {

    static final String OFFICER = "Nguyễn Vũ Nghĩa";
    static final String PRINCIPAL = "Trần Ngọc Tú";
    static final String OTHER_PRINCIPAL = "Lê Bảo Nam";
    static final String OTHER_OFFICER = "Phan Tuấn Đăng";
    static final String SO_SPECIALIST = "Lưu Văn Đông 2";
    static final String SO_LEADER = "Lưu Văn Đông";
    static final String ADMIN = "Quản trị viên hệ thống";
    static final String COUNCIL = "Đặng Hữu Tài — Giáo viên\nHoàng Tuấn Hiếu — Tổ trưởng chuyên môn\n"
            + "Lâm Ngọc Vân — Tổ trưởng chuyên môn";

    static final long SCHOOL = 1503L;
    static final long OTHER_SCHOOL = 1527L;
    static final long SO = 1L;
    static final long OFFICER_ID = 289L;
    static final long PRINCIPAL_ID = 288L;
    static final long OTHER_PRINCIPAL_ID = 277L;
    static final long OTHER_OFFICER_ID = 278L;
    static final long SO_SPECIALIST_ID = 130L;
    static final long SO_LEADER_ID = 129L;
    static final long ADMIN_ID = 1L;
    /** Kết luận của tổ kiểm kê (bắt buộc trước khi trình biên bản). */
    static final String CONCLUSION = "Đã kiểm đủ thiết bị theo sổ. Thiết bị khớp hệ thống, chênh lệch ghi trong bảng kết quả.";
    static final String CONCLUDED_BY = "Hoàng Tuấn Hiếu";
    static final String CAMPAIGN_TITLE = "Kiểm kê toàn địa bàn năm học 2026-2027";

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
            mock(JdbcTemplate.class), approvalFlows, publisher, new InventoryFreeze(freezeJdbc), campus);

    final InventorySessionService sessionService = new InventorySessionService(
            new VoucherServiceDeps(rowLevel, workflow, schools, principals, entityManager, forms, campus), sessions,
            equipment, rooms, catalogs, lifecycle, campaigns, publisher, jdbc);

    final SchoolYearService schoolYears = mock(SchoolYearService.class);
    final NotificationService notifications = mock(NotificationService.class);

    final InventoryCampaignService campaignService = new InventoryCampaignService(campaignRepository, sessions,
            principals, bodies, managedSchools, rowLevel, jdbc, publisher, campus, schoolYears, notifications);

    // ----------------------------------------------------------------- dữ liệu
    final DepartmentOfEducation so10 = body(SO, "Sở Giáo dục và Đào tạo Thành phố Hồ Chí Minh", ManagingBodyType.SO);
    final School school1 = school(SCHOOL, "79000786", "THPT An Nghĩa", so10);
    final School school2 = school(OTHER_SCHOOL, "79000805", "THPT An Lạc", so10);
    final Room room101 = room(1087L, "Phòng Tin học 1", school1);
    final Room room102 = room(1088L, "Phòng Tin học 2", school1);
    final Room roomChemistry = room(1092L, "Phòng bộ môn Hóa học", school1);
    final Room room201 = room(1019L, "Phòng bộ môn Vật lý", school2);
    final EquipmentCatalog projector = catalog(1670L, "Máy tính để bàn hoặc máy tính xách tay", TrackingType.SERIAL);
    final EquipmentCatalog nacl = catalog(1364L, "Sodium chloride (NaCl)", TrackingType.BULK);
    final SchoolYear schoolYear = schoolYear(4L, "NH006", "Năm học 2026-2027", LocalDate.of(2026, 9, 5));

    InventoryFixture() {
        sessionService.setCampusScope(campusScope);
        when(campusScope.pinnedCampusIn(anyLong())).thenReturn(null);
        when(schools.get(SCHOOL)).thenReturn(school1);
        when(schools.get(OTHER_SCHOOL)).thenReturn(school2);
        for (Room room : List.of(room101, room102, roomChemistry, room201)) {
            when(rooms.getAcrossCampuses(room.getId())).thenReturn(room);
        }
        when(catalogs.get(1670L)).thenReturn(projector);
        when(sessions.persist(any())).thenAnswer(inv -> inv.getArgument(0));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(numbers.reserve(any(), eq("KK"), any())).thenReturn("KK-79000786-26-0001");
        when(approvalFlows.chainOf(any())).thenReturn(List.of(ApprovalStep.SCHOOL));
        when(bodies.get(SO)).thenReturn(so10);
        when(rowLevel.asSystem(anyString(), Mockito.<Supplier<Object>>any()))
                .thenAnswer(inv -> ((Supplier<?>) inv.getArgument(1)).get());
    }

    // ----------------------------------------------------------------- tài khoản
    /** Tài khoản đăng nhập (vai trò thật: bảng roles — SCHOOL_STAFF, SCHOOL_LEADER, SO_SPECIALIST, SO_LEADER, ADMIN). */
    void signedInAs(long userId, Long schoolId, Long managingBodyId, String role) {
        when(principals.current()).thenReturn(Optional.of(
                new RowLevelPrincipal(userId, schoolId, managingBodyId, null, Set.of(role), Set.of())));
    }

    /** 79000786.nghiavn — Nguyễn Vũ Nghĩa, cán bộ thiết bị THPT An Nghĩa. */
    void officerOfSchool1() {
        signedInAs(OFFICER_ID, SCHOOL, null, "SCHOOL_STAFF");
    }

    /** 79000805.cbtb — Phan Tuấn Đăng, cán bộ thiết bị THPT An Lạc (tài khoản trường, không thuộc Sở). */
    void officerOfSchool2() {
        signedInAs(OTHER_OFFICER_ID, OTHER_SCHOOL, null, "SCHOOL_STAFF");
    }

    /** 79000786.tunt01 — Trần Ngọc Tú (THPT An Nghĩa) hoặc 79000805.hieutruong — Lê Bảo Nam (THPT An Lạc). */
    void leaderOfSchool(long schoolId) {
        signedInAs(schoolId == SCHOOL ? PRINCIPAL_ID : OTHER_PRINCIPAL_ID, schoolId, null, "SCHOOL_LEADER");
    }

    /** donglv2 — Lưu Văn Đông 2, chuyên viên Sở GD&amp;ĐT TP.HCM. */
    void soSpecialist() {
        signedInAs(SO_SPECIALIST_ID, null, SO, "SO_SPECIALIST");
    }

    /** donglv — Lưu Văn Đông, lãnh đạo Sở GD&amp;ĐT TP.HCM. */
    void soLeader() {
        signedInAs(SO_LEADER_ID, null, SO, "SO_LEADER");
    }

    // ----------------------------------------------------------------- đợt kiểm kê: câu SQL của service
    /** Đã có {@code count} đợt ĐANG MỞ khác của cùng cơ quan, cùng ngày hiệu lực (câu đếm của requireNoOpenTwin). */
    void openTwins(int count) {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(count);
    }

    /**
     * Năm học trong CSDL: năm học {@link #schoolYear} (Năm học 2026-2027, id 4, từ 05/09/2026), năm sau bắt đầu
     * 05/09/2027.
     * {@code yearBeforeCutoff}: id năm học bắt đầu gần nhất trước ngày hiệu lực, {@code null} là chưa khai năm nào.
     */
    void schoolYears(Long yearBeforeCutoff) {
        when(schoolYears.get(4L)).thenReturn(schoolYear);
        when(jdbc.query(anyString(), Mockito.<RowMapper<Object>>any(), any(Object[].class))).thenAnswer(inv -> {
            String sql = inv.getArgument(0);
            if (sql.contains("SELECT id FROM school_years")) {
                return yearBeforeCutoff == null ? List.of() : List.of(yearBeforeCutoff);
            }
            return List.of(LocalDate.of(2027, 9, 5));
        });
    }

    /** admin — Quản trị viên hệ thống. */
    void admin() {
        signedInAs(ADMIN_ID, null, null, "ADMIN");
    }

    // ----------------------------------------------------------------- biên bản dựng sẵn
    /** Biên bản id 84 của THPT An Nghĩa, đợt "Kiểm kê toàn địa bàn năm học 2026-2027", kiểm cả trường, có tổ kiểm kê. */
    InventorySession session(VoucherStatus status, InventoryLine... lines) {
        InventorySession session = new InventorySession();
        ReflectionTestUtils.setField(session, "id", 84L);
        session.setSchool(school1);
        session.setStatus(status);
        session.setTitle(CAMPAIGN_TITLE);
        session.setInventoryDate(LocalDate.of(2026, 11, 26));
        session.setCouncil(COUNCIL);
        session.setConclusion(CONCLUSION);
        session.setConcludedBy(CONCLUDED_BY);
        session.setApprovalStep(status == VoucherStatus.PENDING ? ApprovalStep.SCHOOL : null);
        session.setSubmittedById(status == VoucherStatus.DRAFT ? null : OFFICER_ID);
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

    /** Thiết bị theo sổ: Máy tính để bàn hoặc máy tính xách tay ở Phòng Tin học 1, Tốt, Đang sử dụng. */
    Equipment projectorItem(long id, String code) {
        return item(id, code, projector, room101, EquipmentCondition.TOT, AssetStatus.IN_USE);
    }

    /** Lô 79.D2.12.TB.0067.23 Sodium chloride (NaCl) 99 g ở Phòng bộ môn Hóa học, Tốt, Đang sử dụng. */
    Equipment naclLot() {
        Equipment lot = item(23792L, "79.D2.12.TB.0067.23", nacl, roomChemistry, EquipmentCondition.TOT,
                AssetStatus.IN_USE);
        lot.setQuantity(new BigDecimal("99"));
        return lot;
    }

    /**
     * Đợt kiểm kê "Kiểm kê toàn địa bàn năm học 2026-2027" của Sở GD&amp;ĐT TP.HCM, Năm học 2026-2027, công văn
     * 4125/SGDĐT-KHTC, hiệu lực 26/11/2026, kết thúc 31/12/2026. Repository trả về đợt này khi service đọc theo id.
     */
    InventoryCampaign campaign(long id, boolean closed) {
        return campaign(id, InventoryCampaign.Status.APPROVED, closed);
    }

    InventoryCampaign campaign(long id, InventoryCampaign.Status status, boolean closed) {
        InventoryCampaign campaign = new InventoryCampaign();
        ReflectionTestUtils.setField(campaign, "id", id);
        campaign.setManagingBody(so10);
        campaign.setSchoolYear(schoolYear);
        campaign.setTitle(CAMPAIGN_TITLE);
        campaign.setDocumentNo("4125/SGDĐT-KHTC");
        campaign.setCutoffDate(LocalDate.of(2026, 11, 26));
        campaign.setDeadline(LocalDate.of(2026, 12, 31));
        campaign.setStatus(status);
        campaign.setClosed(closed);
        when(campaignRepository.findOne(Mockito.<Specification<InventoryCampaign>>any()))
                .thenReturn(Optional.of(campaign));
        return campaign;
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
        DepartmentOfEducation body = new DepartmentOfEducation("SGD-HCM", name, type);
        ReflectionTestUtils.setField(body, "id", id);
        return body;
    }

    static School school(Long id, String code, String name, DepartmentOfEducation body) {
        School school = new School(body, code, name);
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

    static SchoolYear schoolYear(Long id, String code, String name, LocalDate start) {
        SchoolYear year = new SchoolYear();
        ReflectionTestUtils.setField(year, "id", id);
        year.setCode(code);
        year.setName(name);
        year.setStartDate(start);
        return year;
    }

    static EquipmentCatalog catalog(Long id, String name, TrackingType tracking) {
        EquipmentCatalog catalog = new EquipmentCatalog();
        ReflectionTestUtils.setField(catalog, "id", id);
        catalog.setName(name);
        catalog.setTrackingType(tracking);
        return catalog;
    }
}
