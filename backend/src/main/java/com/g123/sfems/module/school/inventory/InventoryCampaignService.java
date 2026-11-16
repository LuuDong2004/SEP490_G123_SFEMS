package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.criteria.Predicate;
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

    public InventoryCampaignService(InventoryCampaignRepository repository, InventorySessionRepository sessions,
            RowLevelPrincipalResolver principals,
            DepartmentOfEducationService bodies, ManagedSchoolsCache managedSchools, RowLevelSecurity rowLevel,
            JdbcTemplate jdbc, ApplicationEventPublisher publisher) {
        this.publisher = publisher;
        this.repository = repository;
        this.sessions = sessions;
        this.principals = principals;
        this.bodies = bodies;
        this.managedSchools = managedSchools;
        this.rowLevel = rowLevel;
        this.jdbc = jdbc;
    }

    public record Input(Long managingBodyId, String title, LocalDate cutoffDate, LocalDate deadline, String note,
            Boolean closed) {
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

    public record Progress(int total, int notStarted, int drafting, int pending, int completed,
            List<ProgressRow> schools) {
    }

    public Page<InventoryCampaign> list(ListParams params) {
        Specification<InventoryCampaign> spec = visible();
        if (params.search().isPresent()) {
            String term = params.search().get();
            spec = spec.and((root, q, cb) -> ListParams.foldedLike(cb, root.get("title"), term));
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
        requireNoOpenTwin(campaign);
        InventoryCampaign saved = repository.save(campaign);
        publisher.publishEvent(new CampaignLaunchNotifier.CampaignLaunched(saved.getManagingBody().getId(),
                saved.getManagingBody().getType() == ManagingBodyType.SO, saved.getTitle(), saved.getCutoffDate(),
                saved.getDeadline()));
        return saved;
    }

    /**
     * Một cơ quan không phát động hai đợt ĐANG MỞ cùng ngày chốt số liệu: trường không biết lập
     * phiếu theo đợt nào, và tiến độ bị chia đôi. Bấm Lưu hai lần, hay lập lại cho chắc, là cách
     * danh sách ra mười bốn dòng giống hệt nhau.
     */
    private void requireNoOpenTwin(InventoryCampaign campaign) {
        Integer twins = jdbc.queryForObject("""
                SELECT COUNT(*) FROM inventory_campaigns
                WHERE managing_body_id = ? AND cutoff_date = ? AND NOT closed
                """, Integer.class, campaign.getManagingBody().getId(), campaign.getCutoffDate());
        if (twins != null && twins > 0) {
            throw new FieldValidationException("cutoffDate",
                    "Cơ quan đã có một đợt kiểm kê đang mở chốt số liệu ngày %s — mở đợt đó thay vì lập đợt mới"
                            .formatted(campaign.getCutoffDate().format(DAY)));
        }
    }

    @Transactional
    public InventoryCampaign update(Long id, Input input) {
        InventoryCampaign campaign = owned(id);
        apply(campaign, input);
        return repository.save(campaign);
    }

    @Transactional
    public InventoryCampaign delete(Long id) {
        InventoryCampaign campaign = owned(id);
        Integer used = jdbc.queryForObject("SELECT COUNT(*) FROM inventory_sessions WHERE campaign_id = ?",
                Integer.class, id);
        if (used != null && used > 0) {
            throw new FieldValidationException("id", "Đã có trường lập phiếu kiểm kê theo đợt này — hãy đóng đợt thay vì xoá");
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
                    WHERE i.school_id = s.id AND i.campaign_id = ? AND i.status NOT IN ('CANCELLED', 'REJECTED')
                    ORDER BY i.id DESC LIMIT 1) x ON TRUE
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
        for (ProgressRow row : mine) {
            if (row.status() == null) {
                notStarted++;
            } else {
                switch (row.status()) {
                    case "DRAFT" -> drafting++;
                    case "PENDING", "APPROVED" -> pending++;
                    default -> completed++;
                }
            }
        }
        return new Progress(mine.size(), notStarted, drafting, pending, completed, mine);
    }

    /** Biên bản trong danh sách mà người xem đọc được, theo phạm vi đọc của {@code inventory_sessions}. */
    private Set<Long> readableSessions(List<ProgressRow> rows) {
        List<Long> ids = rows.stream().map(ProgressRow::sessionId).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return Set.of();
        }
        Specification<InventorySession> spec = rowLevel.<InventorySession>scope(InventorySession.class, Action.READ)
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
            List<Predicate> any = new ArrayList<>();
            any.add(cb.equal(root.get("managingBody").get("type"), ManagingBodyType.SO));
            Long body = principal.managingBodyId() != null ? principal.managingBodyId()
                    : principal.schoolId() == null ? null : managedSchools.bodyOf(principal.schoolId());
            if (body != null) {
                any.add(cb.equal(root.get("managingBody").get("id"), body));
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

    private InventoryCampaign owned(Long id) {
        InventoryCampaign campaign = get(id);
        if (!canManage(campaign)) {
            throw new FieldValidationException("managingBody", "Chỉ cơ quan đã phát động mới sửa được đợt kiểm kê này");
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
            throw new FieldValidationException("managingBody", "Chỉ Sở hoặc UBND mới phát động được đợt kiểm kê");
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
        if (input.note() != null) {
            campaign.setNote(input.note().isBlank() ? null : input.note().trim());
        }
        if (input.closed() != null) {
            campaign.setClosed(input.closed());
        }
        if (campaign.getTitle() == null || campaign.getCutoffDate() == null || campaign.getDeadline() == null) {
            throw new FieldValidationException("title", "Nhập tên đợt, ngày chốt số liệu và hạn nộp");
        }
        if (campaign.getDeadline().isBefore(campaign.getCutoffDate())) {
            throw new FieldValidationException("deadline", "Hạn nộp phải sau ngày chốt số liệu");
        }
    }
}
