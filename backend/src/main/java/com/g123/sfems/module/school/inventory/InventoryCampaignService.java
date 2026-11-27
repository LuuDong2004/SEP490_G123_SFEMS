package com.g123.sfems.module.school.inventory;

import com.g123.sfems.module.school.voucher.VoucherCampus;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.domain.school.inventory.InventoryCampaign.Status;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.system.notification.service.NotificationService;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đợt kiểm kê. Ai thấy đợt nào được quyết định ở đây, không qua phạm vi dòng —
 * đợt không phải dữ liệu của một trường:
 * <ul>
 *   <li>Sở và quản trị viên thấy mọi đợt;</li>
 *   <li>UBND thấy đợt của mình và đợt toàn thành phố của Sở;</li>
 *   <li>trường thấy đợt của cơ quan quản lý mình và đợt toàn thành phố.</li>
 * </ul>
 * Chỉ cơ quan đã phát động được sửa, xoá, đóng đợt.
 */
@Service
@Transactional(readOnly = true)
public class InventoryCampaignService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Set<String> SORTABLE = Set.of("id", "title", "cutoffDate", "deadline", "createdAt");

    private final InventoryCampaignRepository repository;
    private final RowLevelPrincipalResolver principals;
    private final DepartmentOfEducationService bodies;
    private final ManagedSchoolsCache managedSchools;
    private final RowLevelSecurity rowLevel;
    private final JdbcTemplate jdbc;
    private final InventorySessionRepository sessions;
    private final ApplicationEventPublisher publisher;

    private final VoucherCampus campus;
    private final SchoolYearService schoolYears;
    private final NotificationService notifications;

    public InventoryCampaignService(InventoryCampaignRepository repository, InventorySessionRepository sessions,
            RowLevelPrincipalResolver principals,
            DepartmentOfEducationService bodies, ManagedSchoolsCache managedSchools, RowLevelSecurity rowLevel,
            JdbcTemplate jdbc, ApplicationEventPublisher publisher, VoucherCampus campus,
            SchoolYearService schoolYears, NotificationService notifications) {
        this.schoolYears = schoolYears;
        this.notifications = notifications;
        this.publisher = publisher;
        this.campus = campus;
        this.repository = repository;
        this.sessions = sessions;
        this.principals = principals;
        this.bodies = bodies;
        this.managedSchools = managedSchools;
        this.rowLevel = rowLevel;
        this.jdbc = jdbc;
    }

    public record Input(Long managingBodyId, Long schoolYearId, String title, String documentNo, LocalDate cutoffDate,
            LocalDate deadline, String note, Boolean closed) {
    }

    /**
     * {@code canOpen}: người xem mở được biên bản này — Sở / UBND không đọc biên bản còn ở bàn hiệu trưởng (125),
     * nên màn tiến độ chỉ gắn đường dẫn khi mở được, thay vì để người bấm gặp "Không tìm thấy".
     */
    public record ProgressRow(Long schoolId, String schoolCode, String schoolName, Long sessionId,
            String sessionCode, String status, boolean canOpen, int facilityChecked, int facilityTotal) {

        ProgressRow withCanOpen(boolean open) {
            return new ProgressRow(schoolId, schoolCode, schoolName, sessionId, sessionCode, status, open,
                    facilityChecked, facilityTotal);
        }
    }

    /**
     * Cùng một cách chia với màn tiến độ: chưa lập phiếu / đang kiểm (nháp) / chờ duyệt / đã duyệt / bị từ chối
     * (phiếu bị từ chối mà trường chưa lập phiếu khác — trước đây lẫn vào "chưa bắt đầu").
     */
    public record Progress(int total, int notStarted, int drafting, int pending, int completed, int rejected,
            List<ProgressRow> schools) {
    }

    public Page<InventoryCampaign> list(ListParams params) {
        Specification<InventoryCampaign> spec = visible();
        if (params.search().isPresent()) {
            String term = params.search().get();
            spec = spec.and((root, q, cb) -> ListParams.foldedLike(cb, root.get("title"), term));
        }
        // Năm học trên header; {@code closed=false}: chỉ đợt đang mở — ô chọn đợt khi lập phiếu không được lọc ở
        // máy người dùng (lấy 20 đợt rồi lọc là mất đợt mới khi có nhiều đợt cũ).
        for (ListParams.Criterion c : params.filters()) {
            if (c.field().equals("schoolYear.id")) {
                long yearId = Long.parseLong(c.value().trim());
                spec = spec.and((root, q, cb) -> cb.equal(root.get("schoolYear").get("id"), yearId));
            } else if (c.field().equals("status")) {
                Status value = Status.valueOf(c.value().trim());
                spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), value));
            } else if (c.field().equals("closed")) {
                boolean value = Boolean.parseBoolean(c.value().trim());
                spec = spec.and((root, q, cb) -> cb.equal(root.get("closed"), value));
            }
        }
        return repository.findAll(spec, params.pageable(SORTABLE, Sort.by(Sort.Order.desc("cutoffDate"))));
    }

    public InventoryCampaign get(Long id) {
        return repository.findOne(visible().and((root, q, cb) -> cb.equal(root.get("id"), id)))
                .orElseThrow(() -> new ResourceNotFoundException("InventoryCampaign", id));
    }

    @Transactional
    public InventoryCampaign create(Input input) {
        InventoryCampaign campaign = new InventoryCampaign();
        campaign.setManagingBody(ownBody(input.managingBodyId()));
        apply(campaign, input);
        campaign.setSchoolYear(schoolYearOf(input.schoolYearId(), campaign.getCutoffDate()));
        requireNoOpenTwin(campaign);
        // Lập là NHÁP (308): chưa tới trường, chưa báo ai — trình rồi Lãnh đạo Sở duyệt mới phát động.
        campaign.setStatus(Status.DRAFT);
        return repository.save(campaign);
    }

    /** Chuyên viên trình đợt nháp: chờ Lãnh đạo Sở duyệt, báo lãnh đạo cùng cơ quan. */
    @Transactional
    public InventoryCampaign submit(Long id) {
        requireNotOver(owned(id));
        InventoryCampaign campaign = draft(owned(id));
        requireNoOpenTwin(campaign);
        campaign.setStatus(Status.PENDING);
        campaign.setSubmittedAt(Instant.now());
        campaign.setApprovalNote(null);
        InventoryCampaign saved = repository.save(campaign);
        List<Long> leaders = jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u
                JOIN user_sos us ON us.id = u.id
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN role_permissions rp ON rp.role_id = ur.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE p.code = 'inventory_campaigns:approve' AND u.status = 'ACTIVE' AND us.managing_body_id = ?
                """, Long.class, saved.getManagingBody().getId());
        for (Long leader : leaders) {
            notifications.notify(NotificationType.VOUCHER_PENDING, leader, NotificationLevel.INFO,
                    "Đợt kiểm kê chờ duyệt: " + saved.getTitle(),
                    "Chuyên viên đã trình đợt kiểm kê — duyệt thì đợt được phát động tới các trường.",
                    "/inventory-campaigns/show/" + saved.getId());
        }
        return saved;
    }

    /** Lãnh đạo Sở duyệt: đợt được phát động — các trường thấy đợt và được báo. */
    @Transactional
    public InventoryCampaign approve(Long id, String note) {
        requireNotOver(get(id));
        InventoryCampaign campaign = pendingForApprover(id);
        requireNoOpenTwin(campaign);
        campaign.setStatus(Status.APPROVED);
        campaign.setApprovedAt(Instant.now());
        campaign.setApprovedById(CurrentUser.id().orElse(null));
        campaign.setApprovalNote(trimToNull(note));
        InventoryCampaign saved = repository.save(campaign);
        // Người lập đợt được báo đợt đã duyệt (trường đã được báo qua CampaignLaunched).
        Long author = jdbc.queryForObject("SELECT created_by_id FROM inventory_campaigns WHERE id = ?", Long.class, id);
        if (author != null && !author.equals(CurrentUser.id().orElse(null))) {
            notifications.notify(NotificationType.VOUCHER_RESULT, author, NotificationLevel.SUCCESS,
                    "Đợt kiểm kê đã được duyệt: " + saved.getTitle(),
                    "Đợt đã phát động tới các trường." + (saved.getApprovalNote() == null ? "" : " Ý kiến: " + saved.getApprovalNote()),
                    "/inventory-campaigns/show/" + saved.getId());
        }
        publisher.publishEvent(new CampaignLaunchNotifier.CampaignLaunched(saved.getManagingBody().getId(),
                saved.getManagingBody().getType() == ManagingBodyType.SO, saved.getTitle(), saved.getCutoffDate(),
                saved.getDeadline()));
        return saved;
    }

    /** Đợt dài nhất (tháng) tính từ ngày hiệu lực. */
    static final int MAX_MONTHS = 12;

    /** Đợt đã quá ngày kết thúc thì không trình, không duyệt — phát động tới trường một đợt đã hết hạn là vô nghĩa. */
    private static void requireNotOver(InventoryCampaign campaign) {
        if (campaign.getDeadline() != null
                && campaign.getDeadline().isBefore(LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")))) {
            throw new FieldValidationException("deadline", "Ngày kết thúc đã qua — sửa ngày trước khi trình, duyệt");
        }
    }

    /** Lãnh đạo Sở trả lại (bắt buộc ghi lý do): đợt về nháp để chuyên viên sửa rồi trình lại. */
    @Transactional
    public InventoryCampaign returnToDraft(Long id, String note) {
        String reason = trimToNull(note);
        if (reason == null) {
            throw new FieldValidationException("note", "Ghi lý do trả lại để chuyên viên biết phải sửa gì");
        }
        String reasonProblem = FieldRule.REASON.violation(reason, 500, 5);
        if (reasonProblem != null) {
            throw new FieldValidationException("note", "Lý do " + reasonProblem);
        }
        InventoryCampaign campaign = pendingForApprover(id);
        campaign.setStatus(Status.DRAFT);
        campaign.setApprovalNote(reason);
        InventoryCampaign saved = repository.save(campaign);
        Long author = jdbc.queryForObject("SELECT created_by_id FROM inventory_campaigns WHERE id = ?", Long.class, id);
        if (author != null) {
            notifications.notify(NotificationType.VOUCHER_RESULT, author, NotificationLevel.WARNING,
                    "Đợt kiểm kê bị trả lại: " + saved.getTitle(), reason, "/inventory-campaigns/show/" + saved.getId());
        }
        return saved;
    }

    /** Các nút người gọi bấm được trên đợt này. */
    public Set<String> actions(InventoryCampaign campaign) {
        Set<String> actions = new java.util.LinkedHashSet<>();
        boolean manage = canManage(campaign);
        if (campaign.getStatus() == Status.DRAFT && manage && CurrentUser.has("inventory_campaigns:write")) {
            actions.add("write");
            actions.add("submit");
        }
        if (campaign.getStatus() == Status.DRAFT && manage && CurrentUser.has("inventory_campaigns:delete")) {
            actions.add("delete");
        }
        if (campaign.getStatus() == Status.PENDING && manage && CurrentUser.has("inventory_campaigns:approve")) {
            actions.add("approve");
        }
        return actions;
    }

    /**
     * Một cơ quan không phát động hai đợt ĐANG MỞ cùng ngày chốt số liệu: trường không biết lập
     * phiếu theo đợt nào, và tiến độ bị chia đôi. Bấm Lưu hai lần, hay lập lại cho chắc, là cách
     * danh sách ra mười bốn dòng giống hệt nhau.
     */
    private void requireNoOpenTwin(InventoryCampaign campaign) {
        if (campaign.isClosed()) {
            return;
        }
        Integer twins = jdbc.queryForObject("""
                SELECT COUNT(*) FROM inventory_campaigns
                WHERE managing_body_id = ? AND cutoff_date = ? AND NOT closed AND id <> ?
                """, Integer.class, campaign.getManagingBody().getId(), campaign.getCutoffDate(),
                campaign.getId() == null ? -1L : campaign.getId());
        if (twins != null && twins > 0) {
            throw new FieldValidationException("cutoffDate",
                    "Cơ quan đã có một đợt kiểm kê đang mở có ngày hiệu lực %s — mở đợt đó thay vì lập đợt mới"
                            .formatted(campaign.getCutoffDate().format(DAY)));
        }
    }

    @Transactional
    public InventoryCampaign update(Long id, Input input) {
        InventoryCampaign campaign = draft(owned(id));
        LocalDate cutoff = campaign.getCutoffDate();
        apply(campaign, input);
        // Trường đã lập phiếu theo đợt thì ngày chốt số liệu đã dùng để đối chiếu sổ — không đổi được nữa.
        if (!cutoff.equals(campaign.getCutoffDate()) && hasSessions(id)) {
            throw new FieldValidationException("cutoffDate",
                    "Đã có trường lập phiếu kiểm kê theo đợt này — không đổi ngày hiệu lực được nữa");
        }
        if (!cutoff.equals(campaign.getCutoffDate()) || input.schoolYearId() != null) {
            campaign.setSchoolYear(schoolYearOf(input.schoolYearId() != null ? input.schoolYearId()
                    : campaign.getSchoolYear() == null ? null : campaign.getSchoolYear().getId(),
                    campaign.getCutoffDate()));
        }
        // Mở lại hay đổi ngày chốt cũng không được thành hai đợt đang mở cùng ngày chốt.
        requireNoOpenTwin(campaign);
        return repository.save(campaign);
    }

    private boolean hasSessions(Long campaignId) {
        Integer used = jdbc.queryForObject(
                "SELECT COUNT(*) FROM inventory_sessions WHERE campaign_id = ? AND status <> 'CANCELLED'",
                Integer.class, campaignId);
        return used != null && used > 0;
    }

    /**
     * Năm học của đợt: năm học được chọn (năm đang làm việc trên header), không chọn thì năm học bắt đầu gần nhất
     * trước ngày chốt. Ngày chốt phải nằm trong năm học đó — từ ngày khai giảng tới trước năm học sau (kiểm kê cuối năm
     * chốt vào hè vẫn thuộc năm vừa qua).
     */
    private SchoolYear schoolYearOf(Long requested, LocalDate cutoff) {
        Long yearId = requested != null ? requested : jdbc.query(
                "SELECT id FROM school_years WHERE start_date <= ? ORDER BY start_date DESC LIMIT 1",
                (rs, i) -> rs.getLong(1), cutoff).stream().findFirst().orElse(null);
        if (yearId == null) {
            throw new FieldValidationException("cutoffDate", "Ngày hiệu lực không thuộc năm học nào đã khai");
        }
        SchoolYear year = schoolYears.get(yearId);
        LocalDate next = jdbc.query(
                "SELECT start_date FROM school_years WHERE start_date > ? ORDER BY start_date LIMIT 1",
                (rs, i) -> rs.getDate(1).toLocalDate(), year.getStartDate()).stream().findFirst()
                .orElse(year.getStartDate().plusYears(1));
        if (cutoff.isBefore(year.getStartDate()) || !cutoff.isBefore(next)) {
            throw new FieldValidationException("cutoffDate", "Ngày hiệu lực phải trong %s (từ %s đến trước %s)"
                    .formatted(year.getName(), year.getStartDate().format(DAY), next.format(DAY)));
        }
        return year;
    }

    @Transactional
    public InventoryCampaign delete(Long id) {
        InventoryCampaign campaign = draft(owned(id));
        Integer used = jdbc.queryForObject("SELECT COUNT(*) FROM inventory_sessions WHERE campaign_id = ?",
                Integer.class, id);
        if (used != null && used > 0) {
            throw new FieldValidationException("id", "Đã có trường lập phiếu kiểm kê theo đợt này — không xoá được");
        }
        repository.delete(campaign);
        return campaign;
    }

    /**
     * Tiến độ: mỗi trường trong phạm vi đợt, với phiếu kiểm kê mới nhất của nó
     * trong đợt (nếu có). Chỉ trường mà người xem đọc được — UBND xem tiến độ đợt
     * toàn thành phố thì chỉ thấy các trường trên địa bàn mình.
     */
    public Progress progress(Long id) {
        InventoryCampaign campaign = get(id);
        DepartmentOfEducation body = campaign.getManagingBody();
        boolean cityWide = body.getType() == ManagingBodyType.SO;
        RowLevelPrincipal principal = principals.current().orElseThrow();
        Set<Long> visibleSchools = visibleSchools(principal);

        List<ProgressRow> rows = jdbc.query("""
                SELECT s.id, s.code, s.name, x.id AS session_id, x.code AS session_code, x.status,
                       COALESCE(f.checked, 0), COALESCE(f.total, 0)
                FROM schools s
                LEFT JOIN LATERAL (
                    SELECT i.id, i.code, i.status FROM inventory_sessions i
                    WHERE i.school_id = s.id AND i.campaign_id = ? AND i.status <> 'CANCELLED'
                    -- Phiếu đang làm trước; bị từ chối chỉ khi trường chưa lập phiếu khác.
                    ORDER BY (i.status = 'REJECTED'), i.id DESC LIMIT 1) x ON TRUE
                LEFT JOIN LATERAL (
                    -- Hạng mục CSVC đã kiểm / tổng của biên bản.
                    SELECT COUNT(*) FILTER (WHERE l.checked) AS checked, COUNT(*) AS total
                    FROM inventory_facility_lines l WHERE l.session_id = x.id) f ON TRUE
                WHERE (? OR s.department_of_education_id = ?)
                ORDER BY s.name""",
                (rs, n) -> new ProgressRow(rs.getLong(1), rs.getString(2), rs.getString(3),
                        (Long) rs.getObject(4), rs.getString(5), rs.getString(6), false, rs.getInt(7), rs.getInt(8)),
                id, cityWide, body.getId());
        List<ProgressRow> mine = visibleSchools == null ? rows
                : rows.stream().filter(r -> visibleSchools.contains(r.schoolId())).toList();
        // Hỏi lại đúng phạm vi đọc của phiếu kiểm kê thay vì chép luật của nó sang đây.
        Set<Long> readable = readableSessions(mine);
        mine = mine.stream()
                .map(r -> r.withCanOpen(r.sessionId() != null && readable.contains(r.sessionId())))
                .toList();
        int notStarted = 0;
        int drafting = 0;
        int pending = 0;
        int completed = 0;
        int rejected = 0;
        for (ProgressRow row : mine) {
            if (row.status() == null) {
                notStarted++;
            } else {
                switch (row.status()) {
                    case "DRAFT" -> drafting++;
                    case "PENDING" -> pending++;
                    case "REJECTED" -> rejected++;
                    // APPROVED chỉ thoáng qua (duyệt xong chuyển ngay COMPLETED) — cùng nhóm "đã duyệt".
                    default -> completed++;
                }
            }
        }
        return new Progress(mine.size(), notStarted, drafting, pending, completed, rejected, mine);
    }

    /** Biên bản trong danh sách mà người xem đọc được, theo phạm vi đọc của {@code inventory_sessions}. */
    private Set<Long> readableSessions(List<ProgressRow> rows) {
        List<Long> ids = rows.stream().map(ProgressRow::sessionId).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return Set.of();
        }
        Specification<InventorySession> spec = rowLevel.<InventorySession>scope(InventorySession.class, Action.READ)
                .and(campus.pinned(InventorySessionService.CAMPUS))
                .and((root, q, cb) -> root.get("id").in(ids));
        return sessions.findAll(spec).stream().map(InventorySession::getId).collect(Collectors.toSet());
    }

    public boolean canManage(InventoryCampaign campaign) {
        return principals.current()
                .map(p -> isAdmin(p) || Objects.equals(p.managingBodyId(), campaign.getManagingBody().getId()))
                .orElse(false);
    }

    // ------------------------------------------------------------------ nội bộ

    private Specification<InventoryCampaign> visible() {
        RowLevelPrincipal principal = principals.current().orElse(null);
        return (root, q, cb) -> {
            if (principal == null) {
                return cb.disjunction();
            }
            if (isAdmin(principal) || isCityBody(principal.managingBodyId())) {
                return cb.conjunction();
            }
            // Ngoài cơ quan lập đợt (trường, UBND khác) chỉ thấy đợt đã duyệt — nháp, chờ duyệt là việc nội bộ cơ quan.
            Predicate approved = cb.equal(root.get("status"), Status.APPROVED);
            List<Predicate> any = new ArrayList<>();
            any.add(cb.and(cb.equal(root.get("managingBody").get("type"), ManagingBodyType.SO), approved));
            Long body = principal.managingBodyId() != null ? principal.managingBodyId()
                    : principal.schoolId() == null ? null : managedSchools.bodyOf(principal.schoolId());
            if (body != null) {
                Predicate own = cb.equal(root.get("managingBody").get("id"), body);
                any.add(principal.managingBodyId() != null ? own : cb.and(own, approved));
            }
            return cb.or(any.toArray(Predicate[]::new));
        };
    }

    /** Trường mà người xem được thấy trong bảng tiến độ; {@code null} là tất cả. */
    private Set<Long> visibleSchools(RowLevelPrincipal principal) {
        if (isAdmin(principal) || isCityBody(principal.managingBodyId())) {
            return null;
        }
        if (principal.managingBodyId() != null) {
            return managedSchools.schoolsOf(principal.managingBodyId());
        }
        return principal.schoolId() == null ? Set.of() : Set.of(principal.schoolId());
    }

    /** Đợt mà người dùng hiện tại sửa được (cơ quan đã phát động) — dùng cho tệp đính kèm của đợt. */
    public InventoryCampaign getWritable(Long id) {
        return draft(owned(id));
    }

    /** Chỉ đợt NHÁP sửa / xoá / đổi tệp được: đã trình thì người duyệt đang xét, đã duyệt thì các trường đang làm theo. */
    private static InventoryCampaign draft(InventoryCampaign campaign) {
        if (campaign.getStatus() != Status.DRAFT) {
            throw new FieldValidationException("status", campaign.getStatus() == Status.PENDING
                    ? "Đợt kiểm kê đang chờ Lãnh đạo Sở duyệt — không sửa, xoá hay đổi tệp được"
                    : "Đợt kiểm kê đã được duyệt, phát động tới các trường — không sửa, xoá hay đổi tệp được nữa");
        }
        return campaign;
    }

    private InventoryCampaign pendingForApprover(Long id) {
        InventoryCampaign campaign = get(id);
        if (!canManage(campaign)) {
            throw new FieldValidationException("managingBody", "Chỉ lãnh đạo cơ quan đã lập đợt mới duyệt được đợt này");
        }
        if (campaign.getStatus() != Status.PENDING) {
            throw new FieldValidationException("status", "Đợt kiểm kê không ở trạng thái chờ duyệt");
        }
        return campaign;
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private InventoryCampaign owned(Long id) {
        InventoryCampaign campaign = get(id);
        if (!canManage(campaign)) {
            throw new FieldValidationException("managingBody", "Chỉ cơ quan đã lập đợt mới sửa được đợt kiểm kê này");
        }
        return campaign;
    }

    private DepartmentOfEducation ownBody(Long requested) {
        RowLevelPrincipal principal = principals.current().orElseThrow();
        Long body = principal.managingBodyId();
        if (body == null && isAdmin(principal)) {
            body = requested;
        }
        if (body == null) {
            throw new FieldValidationException("managingBody", "Chỉ Sở phát động được đợt kiểm kê");
        }
        Long bodyId = body;
        return rowLevel.asSystem("inventory_campaigns.body", () -> bodies.get(bodyId));
    }

    private boolean isCityBody(Long bodyId) {
        return managedSchools.isCityBody(bodyId);
    }

    private static boolean isAdmin(RowLevelPrincipal principal) {
        return principal.roleCodes().contains("ADMIN");
    }

    private static void apply(InventoryCampaign campaign, Input input) {
        if (input.title() != null && !input.title().isBlank()) {
            campaign.setTitle(input.title().trim());
        }
        if (input.cutoffDate() != null) {
            campaign.setCutoffDate(input.cutoffDate());
        }
        if (input.deadline() != null) {
            campaign.setDeadline(input.deadline());
        }
        if (input.documentNo() != null) {
            campaign.setDocumentNo(input.documentNo().isBlank() ? null : input.documentNo().trim());
        }
        if (input.note() != null) {
            campaign.setNote(input.note().isBlank() ? null : input.note().trim());
        }
        if (input.closed() != null) {
            campaign.setClosed(input.closed());
        }
        // Mỗi lỗi gắn đúng ô của nó để form tô đỏ đúng chỗ.
        if (campaign.getTitle() == null) {
            throw new FieldValidationException("title", "Nhập tên đợt kiểm kê");
        }
        if (campaign.getCutoffDate() == null) {
            throw new FieldValidationException("cutoffDate", "Chọn ngày hiệu lực");
        }
        if (campaign.getDeadline() == null) {
            throw new FieldValidationException("deadline", "Chọn ngày kết thúc");
        }
        if (campaign.getDeadline().isBefore(campaign.getCutoffDate())) {
            throw new FieldValidationException("deadline", "Ngày kết thúc không được trước ngày hiệu lực");
        }
        // Một đợt kiểm kê không kéo dài quá một năm — quá thì là gõ nhầm năm.
        if (campaign.getDeadline().isAfter(campaign.getCutoffDate().plusMonths(MAX_MONTHS))) {
            throw new FieldValidationException("deadline", "Đợt kiểm kê kéo dài tối đa " + MAX_MONTHS + " tháng");
        }
    }
}
