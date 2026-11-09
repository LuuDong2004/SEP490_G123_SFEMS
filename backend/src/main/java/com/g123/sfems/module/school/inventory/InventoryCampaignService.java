package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đợt kiểm kê (KK-01). Ai thấy đợt nào được quyết định ở đây, không qua phạm vi dòng — đợt không phải
 * dữ liệu của một trường:
 * <ul>
 *   <li>Sở và quản trị viên thấy mọi đợt;</li>
 *   <li>trường thấy đợt của Sở quản lý mình.</li>
 * </ul>
 * Chỉ cơ quan đã phát động (hoặc quản trị viên) được sửa, xoá, đóng đợt.
 */
@Service
@Transactional(readOnly = true)
public class InventoryCampaignService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Set<String> SORTABLE = Set.of("id", "title", "cutoffDate", "deadline", "createdAt");

    private final InventoryCampaignRepository repository;
    private final RowLevelPrincipalResolver principals;
    private final DepartmentOfEducationService bodies;
    private final RowLevelSecurity rowLevel;
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher publisher;

    public InventoryCampaignService(InventoryCampaignRepository repository, RowLevelPrincipalResolver principals,
            DepartmentOfEducationService bodies, RowLevelSecurity rowLevel, JdbcTemplate jdbc,
            ApplicationEventPublisher publisher) {
        this.repository = repository;
        this.principals = principals;
        this.bodies = bodies;
        this.rowLevel = rowLevel;
        this.jdbc = jdbc;
        this.publisher = publisher;
    }

    /** Dữ liệu nhập của form phát động / sửa đợt; trường {@code null} là để nguyên. */
    public record Input(Long managingBodyId, String title, LocalDate cutoffDate, LocalDate deadline, String note,
            Boolean closed) {
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
        publisher.publishEvent(new CampaignLaunched(saved.getManagingBody().getId(),
                saved.getTitle(), saved.getCutoffDate(), saved.getDeadline()));
        return saved;
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

    /** Người đang đăng nhập được sửa, xoá, đóng đợt này không. */
    public boolean canManage(InventoryCampaign campaign) {
        return principals.current()
                .map(p -> isAdmin(p) || Objects.equals(p.managingBodyId(), campaign.getManagingBody().getId()))
                .orElse(false);
    }

    // ------------------------------------------------------------------ nội bộ

    /**
     * Một cơ quan không phát động hai đợt ĐANG MỞ cùng ngày chốt số liệu: trường không biết lập phiếu theo
     * đợt nào, và tiến độ bị chia đôi. Bấm Lưu hai lần là cách danh sách ra nhiều dòng giống hệt nhau.
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

    /** Sở và quản trị viên thấy mọi đợt; tài khoản trường thấy đợt của Sở quản lý trường mình. */
    private Specification<InventoryCampaign> visible() {
        RowLevelPrincipal principal = principals.current().orElse(null);
        return (root, q, cb) -> {
            if (principal == null) {
                return cb.disjunction();
            }
            if (isAdmin(principal) || principal.managingBodyId() != null) {
                return cb.conjunction();
            }
            Long body = principal.schoolId() == null ? null : bodyOfSchool(principal.schoolId());
            return body == null ? cb.disjunction() : cb.equal(root.get("managingBody").get("id"), body);
        };
    }

    private Long bodyOfSchool(Long schoolId) {
        List<Long> ids = jdbc.queryForList("SELECT department_of_education_id FROM schools WHERE id = ?",
                Long.class, schoolId);
        return ids.isEmpty() ? null : ids.get(0);
    }

    private InventoryCampaign owned(Long id) {
        InventoryCampaign campaign = get(id);
        if (!canManage(campaign)) {
            throw new FieldValidationException("managingBody", "Chỉ cơ quan đã phát động mới sửa được đợt kiểm kê này");
        }
        return campaign;
    }

    /**
     * Cơ quan phát động là cơ quan của tài khoản đang đăng nhập. Quản trị viên không thuộc cơ quan nào:
     * phát động thay cho cơ quan được chọn, không chọn thì là Sở.
     */
    private DepartmentOfEducation ownBody(Long requested) {
        RowLevelPrincipal principal = principals.current().orElseThrow();
        Long body = principal.managingBodyId();
        if (body == null && isAdmin(principal)) {
            body = requested != null ? requested : departmentId();
        }
        if (body == null) {
            throw new FieldValidationException("managingBody", "Chỉ Sở mới phát động được đợt kiểm kê");
        }
        Long bodyId = body;
        return rowLevel.asSystem("inventory_campaigns.body", () -> bodies.get(bodyId));
    }

    /** Id của Sở GD&ĐT — phạm vi hệ thống chỉ có một Sở. */
    private Long departmentId() {
        List<Long> ids = jdbc.queryForList(
                "SELECT id FROM departments_of_education WHERE type = ? ORDER BY id LIMIT 1",
                Long.class, ManagingBodyType.SO.name());
        return ids.isEmpty() ? null : ids.get(0);
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
