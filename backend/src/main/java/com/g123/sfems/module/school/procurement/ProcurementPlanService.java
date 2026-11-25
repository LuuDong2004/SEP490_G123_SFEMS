package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.ProcurementPlan.Status;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.voucher.VoucherForms;
import com.g123.sfems.module.school.voucher.VoucherWorkflow;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.module.system.notification.service.NotificationService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kế hoạch mua sắm của một cơ quan quản lý.
 *
 * <p>Ai thấy kế hoạch nào: Sở và quản trị viên thấy mọi kế hoạch (tổng hợp toàn
 * ngành); UBND thấy kế hoạch của mình; TRƯỜNG chỉ thấy kế hoạch ĐÃ DUYỆT có đề xuất
 * của chính mình, và trong đó chỉ thấy đề xuất của mình ({@code 115}). Chỉ chuyên viên của CHÍNH cơ quan lập kế
 * hoạch mới sửa, trình được; chỉ lãnh đạo của chính cơ quan đó mới duyệt.
 *
 * <p>Một kế hoạch chỉ nhận đề xuất ĐÃ DUYỆT của các trường mà cơ quan đó quản lý
 * — cùng cơ quan đã duyệt đề xuất ở bước "cơ quan quản lý". Một đề xuất nằm trong
 * nhiều nhất một kế hoạch.
 */
@Service
@Transactional(readOnly = true)
public class ProcurementPlanService {

    private static final Set<String> SORTABLE = Set.of("id", "title", "budgetYear", "status", "createdAt");

    private final ProcurementPlanRepository repository;
    private final PurchaseProposalRepository proposals;
    private final RowLevelPrincipalResolver principals;
    private final RowLevelSecurity rowLevel;
    private final DepartmentOfEducationService bodies;
    private final ManagedSchoolsCache managedSchools;
    private final VoucherWorkflow workflow;
    private final VisibleSchools visibleSchools;
    private final JdbcTemplate jdbc;
    private final VoucherForms forms;
    private final SchoolYearService schoolYears;
    private final NotificationService notifications;

    public ProcurementPlanService(ProcurementPlanRepository repository, PurchaseProposalRepository proposals,
            RowLevelPrincipalResolver principals, RowLevelSecurity rowLevel, DepartmentOfEducationService bodies,
            ManagedSchoolsCache managedSchools, VoucherWorkflow workflow, VisibleSchools visibleSchools,
            JdbcTemplate jdbc, VoucherForms forms, SchoolYearService schoolYears, NotificationService notifications) {
        this.repository = repository;
        this.proposals = proposals;
        this.principals = principals;
        this.rowLevel = rowLevel;
        this.bodies = bodies;
        this.managedSchools = managedSchools;
        this.workflow = workflow;
        this.visibleSchools = visibleSchools;
        this.jdbc = jdbc;
        this.forms = forms;
        this.schoolYears = schoolYears;
        this.notifications = notifications;
    }

    /**
     * {@code lines}: dòng đề xuất trong kế hoạch và số đưa vào kế hoạch của từng dòng. Có mặt thì THAY tập đề
     * xuất của kế hoạch bằng các đề xuất chứa những dòng đó; dòng của một đề xuất có mặt mà không được kê thì
     * lấy đủ số đề nghị. {@code null} là để nguyên.
     */
    public record Input(Long managingBodyId, String title, Integer budgetYear, Long schoolYearId, LocalDate planDate,
            String note, List<LineQuantity> lines, Map<String, Object> details) {
    }

    /**
     * Một dòng đề xuất trong kế hoạch: số đưa vào kế hoạch, 0 (bỏ dòng) tới số đề nghị; và đơn giá kế hoạch —
     * {@code null} là theo giá trường ghi.
     */
    public record LineQuantity(Long lineId,
            @Num(value = NumberRule.QUANTITY_OR_ZERO, label = "Số lượng đưa vào kế hoạch") Integer plannedQuantity,
            @Num(value = NumberRule.MONEY, label = "Đơn giá") BigDecimal unitPrice) {
    }

    /** Cộng theo nhóm thiết bị trên mọi đề xuất trong kế hoạch. */
    public record CatalogTotal(Long catalogId, String catalogCode, String catalogName, String unitName,
            int quantity, BigDecimal amount, int schools) {
    }

    public record Detail(ProcurementPlan plan, List<PurchaseProposal> proposals, List<CatalogTotal> totals,
            BigDecimal totalAmount) {
    }

    public record BodyTotal(Long bodyId, String bodyName, int schools, int proposals, int pending, int approved,
            int planned, BigDecimal amount, BigDecimal approvedAmount) {
    }

    public record Summary(Integer year, List<BodyTotal> bodies, List<CatalogTotal> catalogs, BigDecimal amount,
            BigDecimal approvedAmount) {
    }

    // ------------------------------------------------------------------ đọc

    public Page<ProcurementPlan> list(ListParams params) {
        Specification<ProcurementPlan> spec = visible();
        for (ListParams.Criterion c : params.filters()) {
            if ("budgetYear".equals(c.field())) {
                spec = spec.and((root, q, cb) -> cb.equal(root.get("budgetYear"), Integer.valueOf(c.value())));
            } else if ("status".equals(c.field())) {
                spec = spec.and((root, q, cb) -> cb.equal(root.get("status").as(String.class), c.value()));
            } else if ("managingBody.id".equals(c.field())) {
                spec = spec.and((root, q, cb) -> cb.equal(root.get("managingBody").get("id"), Long.valueOf(c.value())));
            }
        }
        if (params.search().isPresent()) {
            // Không phân biệt dấu, như mọi ô tìm khác.
            String term = params.search().get();
            spec = spec.and((root, q, cb) -> ListParams.foldedLike(cb, root.get("title"), term));
        }
        return repository.findAll(spec, params.pageable(SORTABLE,
                Sort.by(Sort.Order.desc("budgetYear"), Sort.Order.desc("id"))));
    }

    public ProcurementPlan get(Long id) {
        return repository.findOne(visible().and((root, q, cb) -> cb.equal(root.get("id"), id)))
                .orElseThrow(() -> new ResourceNotFoundException("ProcurementPlan", id));
    }

    public Detail detail(Long id) {
        ProcurementPlan plan = get(id);
        List<PurchaseProposal> rows = rowLevel.asSystem("procurement_plans.proposals",
                () -> proposals.findAll((root, q, cb) -> cb.equal(root.get("plan").get("id"), id),
                        Sort.by("school.name", "id")));
        // Tài khoản của một trường: kế hoạch gồm đề xuất của nhiều trường, trường chỉ xem phần của mình.
        Long ownSchool = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        if (ownSchool != null) {
            rows = rows.stream().filter(p -> ownSchool.equals(p.getSchool().getId())).toList();
        }
        rows.forEach(p -> p.getLines().size());
        List<CatalogTotal> totals = totals(rows);
        // Theo số ĐƯA VÀO KẾ HOẠCH, không theo số đề nghị: phần cơ quan bớt đi không phải là tiền sẽ chi.
        BigDecimal amount = rows.stream().flatMap(p -> p.getLines().stream())
                .map(PurchaseProposalLine::plannedAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Detail(plan, rows, totals, amount);
    }

    /**
     * Đề xuất đã duyệt, chưa vào kế hoạch nào, của các trường cơ quan lập kế hoạch quản lý, CÙNG NĂM NGÂN SÁCH với kế
     * hoạch. {@code schoolYearId}: năm học đang chọn trên màn (chưa lưu) — có thì năm ngân sách theo năm học đó.
     */
    public List<PurchaseProposal> candidates(Long id, Long schoolYearId) {
        ProcurementPlan plan = get(id);
        return candidatesOf(plan.getManagingBody().getId(),
                schoolYearId != null ? budgetYearOf(schoolYearId) : plan.getBudgetYear());
    }

    /**
     * Như {@link #candidates(Long, Long)} nhưng cho kế hoạch CHƯA LƯU: cơ quan là cơ quan của người lập (quản trị
     * viên thì cơ quan được chọn) — màn lập kế hoạch chọn đề xuất trước khi lưu lần đầu. Chưa chọn năm học thì không
     * lọc năm (lúc lưu vẫn kiểm).
     */
    public List<PurchaseProposal> candidatesForNew(Long requestedBody, Long schoolYearId) {
        return candidatesOf(ownBody(requestedBody).getId(), schoolYearId == null ? null : budgetYearOf(schoolYearId));
    }

    /** Năm ngân sách của một năm học: năm kết thúc (2026-2027 → 2027) — cùng luật với {@link #apply}. */
    private int budgetYearOf(Long schoolYearId) {
        return schoolYears.get(schoolYearId).getEndDate().getYear();
    }

    private List<PurchaseProposal> candidatesOf(Long bodyId, Integer budgetYear) {
        Set<Long> schools = managedSchools.schoolsOf(bodyId);
        if (schools.isEmpty()) {
            return List.of();
        }
        List<PurchaseProposal> rows = proposals.findAll(rowLevel.<PurchaseProposal>scope(PurchaseProposal.class,
                Action.READ).and((root, q, cb) -> cb.and(
                        cb.equal(root.get("status"), VoucherStatus.APPROVED),
                        cb.isNull(root.get("plan")),
                        root.get("school").get("id").in(schools),
                        budgetYear == null ? cb.conjunction() : cb.equal(root.get("budgetYear"), budgetYear))),
                Sort.by("school.name", "id"));
        rows.forEach(p -> p.getLines().size());
        return rows;
    }

    /**
     * Tổng hợp theo năm ngân sách: mỗi cơ quan quản lý bao nhiêu đề xuất, bao
     * nhiêu tiền, bao nhiêu đã duyệt / đã vào kế hoạch; và cộng theo nhóm thiết
     * bị. Sở thấy toàn ngành, UBND thấy địa bàn mình.
     */
    public Summary summary(Integer year) {
        return summary(year, null);
    }

    /** {@code bodyId}: chỉ trường của MỘT cơ quan quản lý — mỗi cơ quan lập kế hoạch mua sắm của riêng mình. */
    public Summary summary(Integer year, Long bodyId) {
        Set<Long> visible = visibleSchools.current();
        if (visible != null && visible.isEmpty()) {
            return new Summary(year, List.of(), List.of(), BigDecimal.ZERO, BigDecimal.ZERO);
        }
        String schoolFilter = visible == null ? "" : " AND p.school_id IN (" + String.join(",",
                visible.stream().map(String::valueOf).toList()) + ")";
        String yearFilter = year == null ? "" : " AND p.budget_year = " + year.intValue();
        if (bodyId != null) {
            yearFilter += " AND s.department_of_education_id = " + bodyId.longValue();
        }
        String base = """
                FROM purchase_proposals p
                JOIN schools s ON s.id = p.school_id
                LEFT JOIN departments_of_education d ON d.id = s.department_of_education_id
                WHERE p.status IN ('PENDING', 'APPROVED', 'COMPLETED')""" + schoolFilter + yearFilter;
        // Luật đếm của màn tổng hợp:
        // - "Tổng dự toán đề xuất": số TRƯỜNG ĐỀ NGHỊ × đơn giá.
        // - "Đã được duyệt" và bảng "Thiết bị cần mua": số ĐƯA VÀO KẾ HOẠCH khi đề xuất đã nằm trong một kế hoạch
        //   (planned_quantity chỉ có giá trị lúc đó), không thì số đề nghị — phần cơ quan bớt không phải là thứ sẽ mua.
        // - Đơn giá kế hoạch (planned_unit_price) chỉ tính khi kế hoạch ĐÃ DUYỆT (đề xuất hoàn tất); kế hoạch còn nháp /
        //   chờ duyệt thì giá đó chưa là quyết định, dùng giá trường ghi. Nhờ vậy số "đã duyệt" không vượt "tổng dự toán".
        // - "Đã vào kế hoạch": đề xuất đang nằm trong một kế hoạch (nháp, chờ duyệt hay đã duyệt) hoặc đã hoàn tất — cùng
        //   luật với báo cáo mua sắm (ReportService.PLANNED).
        String price = "CASE WHEN p.status = 'COMPLETED' THEN COALESCE(l.planned_unit_price, l.unit_price, 0)"
                + " ELSE COALESCE(l.unit_price, 0) END";
        String planned = "COALESCE(l.planned_quantity, l.quantity)";
        List<BodyTotal> byBody = jdbc.query("""
                SELECT d.id, COALESCE(d.name, 'Chưa có cơ quan quản lý'),
                       COUNT(DISTINCT p.school_id), COUNT(*),
                       COUNT(*) FILTER (WHERE p.status = 'PENDING'),
                       COUNT(*) FILTER (WHERE p.status IN ('APPROVED', 'COMPLETED')),
                       COUNT(*) FILTER (WHERE p.plan_id IS NOT NULL OR p.status = 'COMPLETED'),
                       COALESCE(SUM(t.amount), 0),
                       COALESCE(SUM(t.planned_amount) FILTER (WHERE p.status IN ('APPROVED', 'COMPLETED')), 0)
                """ + base.replace("WHERE", """
                LEFT JOIN LATERAL (SELECT SUM(l.quantity * %1$s) AS amount, SUM(%2$s * %1$s) AS planned_amount
                                   FROM purchase_proposal_lines l WHERE l.proposal_id = p.id) t ON TRUE
                WHERE""".formatted(price, planned)) + " GROUP BY d.id, d.name ORDER BY 8 DESC",
                (rs, n) -> new BodyTotal((Long) rs.getObject(1), rs.getString(2), rs.getInt(3), rs.getInt(4),
                        rs.getInt(5), rs.getInt(6), rs.getInt(7), rs.getBigDecimal(8), rs.getBigDecimal(9)));
        // Dòng cơ quan bỏ (số đưa vào kế hoạch 0) không phải thiết bị cần mua, và không làm tăng "số trường".
        List<CatalogTotal> byCatalog = jdbc.query("""
                SELECT c.id, c.code, c.name, MAX(l.unit_name), SUM(%2$s),
                       COALESCE(SUM(%2$s * %1$s), 0), COUNT(DISTINCT p.school_id)
                """.formatted(price, planned) + base.replace("WHERE", """
                JOIN purchase_proposal_lines l ON l.proposal_id = p.id
                JOIN equipment_catalogs c ON c.id = l.catalog_id
                WHERE""") + " AND " + planned + " > 0 GROUP BY c.id, c.code, c.name ORDER BY 6 DESC",
                (rs, n) -> new CatalogTotal(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getInt(5), rs.getBigDecimal(6), rs.getInt(7)));
        BigDecimal amount = byBody.stream().map(BodyTotal::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal approved = byBody.stream().map(BodyTotal::approvedAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Summary(year, byBody, byCatalog, amount, approved);
    }

    // ------------------------------------------------------------------ ghi

    @Transactional
    public ProcurementPlan create(Input input) {
        ProcurementPlan plan = new ProcurementPlan();
        plan.setManagingBody(ownBody(input.managingBodyId()));
        plan.setStatus(Status.DRAFT);
        apply(plan, input);
        plan.setPlanDate(input.planDate() != null ? input.planDate() : LocalDate.now());
        plan.setCode(nextCode(plan.getBudgetYear()));
        plan.setDetails(forms.header("procurement_plans", input.details(), null, null));
        ProcurementPlan saved = repository.save(plan);
        if (input.lines() != null) {
            applyLines(saved, input.lines());
        }
        return saved;
    }

    @Transactional
    public ProcurementPlan update(Long id, Input input) {
        ProcurementPlan plan = ownedDraft(id);
        apply(plan, input);
        if (input.planDate() != null) {
            plan.setPlanDate(input.planDate());
        }
        if (input.details() != null) {
            plan.setDetails(forms.header("procurement_plans", input.details(), plan.getDetails(), null));
        }
        ProcurementPlan saved = repository.save(plan);
        if (input.lines() != null) {
            applyLines(saved, input.lines());
        } else {
            requireProposalsOfYear(saved);
        }
        return saved;
    }

    /**
     * Thay tập dòng của kế hoạch nháp: các đề xuất chứa những dòng được kê vào kế hoạch (cùng luật với
     * {@link #setProposals}), rồi từng dòng nhận số đưa vào kế hoạch.
     */
    private void applyLines(ProcurementPlan plan, List<LineQuantity> lines) {
        Map<Long, Integer> wanted = new HashMap<>();
        Map<Long, BigDecimal> prices = new HashMap<>();
        for (LineQuantity l : lines) {
            if (l == null || l.lineId() == null) {
                throw new FieldValidationException("lines", "Dòng đề xuất thiếu mã dòng");
            }
            wanted.put(l.lineId(), l.plannedQuantity());
            prices.put(l.lineId(), l.unitPrice());
        }
        List<Long> proposalIds = new ArrayList<>();
        if (!wanted.isEmpty()) {
            String ids = String.join(",", wanted.keySet().stream().map(String::valueOf).toList());
            Map<Long, Long> owner = new HashMap<>();
            jdbc.query("SELECT id, proposal_id FROM purchase_proposal_lines WHERE id IN (" + ids + ")",
                    rs -> {
                        owner.put(rs.getLong(1), rs.getLong(2));
                    });
            if (owner.size() != wanted.size()) {
                throw new FieldValidationException("lines", "Có dòng đề xuất không tồn tại");
            }
            proposalIds = owner.values().stream().distinct().toList();
        }
        setProposals(plan.getId(), proposalIds);
        List<PurchaseProposal> rows = rowLevel.asSystem("procurement_plans.proposals",
                () -> proposals.findAll((root, q, cb) -> cb.equal(root.get("plan").get("id"), plan.getId())));
        for (PurchaseProposal p : rows) {
            for (PurchaseProposalLine line : p.getLines()) {
                int requested = line.getQuantity() == null ? 0 : line.getQuantity();
                Integer planned = wanted.get(line.getId());
                int value = planned == null ? requested : planned;
                if (value < 0 || value > requested) {
                    throw new FieldValidationException("lines",
                            "%s — %s: số đưa vào kế hoạch phải từ 0 tới %d (số trường đề nghị)".formatted(
                                    p.getCode(), line.getName(), requested));
                }
                line.setPlannedQuantity(value);
                // Giá cơ quan đặt; trùng giá trường ghi (hoặc để trống) thì không giữ bản riêng — theo giá trường.
                BigDecimal price = prices.get(line.getId());
                line.setPlannedUnitPrice(price == null || price.signum() <= 0
                        || (line.getUnitPrice() != null && price.compareTo(line.getUnitPrice()) == 0) ? null : price);
            }
            proposals.persist(p);
        }
    }

    private static final Pattern CODE_NUMBER = Pattern.compile("-(\\d+)$");

    /** Mã kế hoạch kế tiếp trong năm ngân sách: {@code KHMS-2027-001}… — số lớn nhất đang có + 1. */
    private String nextCode(int year) {
        String prefix = "KHMS-" + year + "-";
        int max = 0;
        for (String code : jdbc.queryForList("SELECT code FROM procurement_plans WHERE code LIKE ?", String.class,
                prefix + "%")) {
            Matcher m = CODE_NUMBER.matcher(code);
            if (m.find()) {
                max = Math.max(max, Integer.parseInt(m.group(1)));
            }
        }
        return prefix + String.format("%03d", max + 1);
    }

    @Transactional
    public ProcurementPlan delete(Long id) {
        ProcurementPlan plan = ownedDraft(id);
        // Giá / số do kế hoạch này đặt không được theo đề xuất sang kế hoạch sau.
        jdbc.update("""
                UPDATE purchase_proposal_lines SET planned_quantity = NULL, planned_unit_price = NULL
                WHERE proposal_id IN (SELECT id FROM purchase_proposals WHERE plan_id = ?)""", id);
        jdbc.update("UPDATE purchase_proposals SET plan_id = NULL WHERE plan_id = ?", id);
        repository.delete(plan);
        return plan;
    }

    /** Thay tập đề xuất trong kế hoạch nháp. */
    @Transactional
    public ProcurementPlan setProposals(Long id, List<Long> proposalIds) {
        ProcurementPlan plan = ownedDraft(id);
        Long bodyId = plan.getManagingBody().getId();
        Set<Long> wanted = new HashSet<>(proposalIds == null ? List.of() : proposalIds);
        List<PurchaseProposal> current = rowLevel.asSystem("procurement_plans.proposals",
                () -> proposals.findAll((root, q, cb) -> cb.equal(root.get("plan").get("id"), id)));
        for (PurchaseProposal p : current) {
            if (!wanted.contains(p.getId())) {
                p.setPlan(null);
                clearPlanned(p);
                proposals.persist(p);
            }
        }
        if (!wanted.isEmpty()) {
            // Khoá các đề xuất (theo id) và đọc kế hoạch đang giữ chúng NGAY trong câu khoá: hai cơ quan lưu hai kế
            // hoạch nháp cùng một đề xuất thì người sau chờ người trước commit rồi thấy đề xuất đã thuộc kế hoạch kia.
            // Đọc qua entity thì có thể nhận lại bản đã nạp trong giao dịch này, chưa có plan_id mới.
            Map<Long, Long> lockedPlan = new HashMap<>();
            jdbc.query("SELECT id, plan_id FROM purchase_proposals WHERE id = ANY (?) ORDER BY id FOR UPDATE",
                    rs -> {
                        // wasNull() nói về cột đọc SAU CÙNG: đọc id trước, plan_id sau rồi mới hỏi.
                        long proposalId = rs.getLong(1);
                        long planId = rs.getLong(2);
                        lockedPlan.put(proposalId, rs.wasNull() ? null : planId);
                    }, (Object) wanted.toArray(Long[]::new));
            List<PurchaseProposal> adding = proposals.findAll(rowLevel.<PurchaseProposal>scope(PurchaseProposal.class,
                    Action.READ).and((root, q, cb) -> root.get("id").in(wanted)));
            if (adding.size() != wanted.size()) {
                throw new FieldValidationException("proposals", "Có đề xuất không tồn tại hoặc bạn không xem được");
            }
            for (PurchaseProposal p : adding) {
                Long heldBy = lockedPlan.get(p.getId());
                // Kế hoạch chi tiền của MỘT năm ngân sách: đề xuất xin cho năm khác không vào được — kể cả đề xuất đã nằm
                // sẵn trong kế hoạch rồi kế hoạch đổi năm học.
                requireSameYear(p, plan);
                if (heldBy != null && heldBy.equals(id)) {
                    continue;
                }
                if (p.getStatus() != VoucherStatus.APPROVED || heldBy != null) {
                    throw new FieldValidationException("proposals",
                            "Đề xuất %s chưa được duyệt hoặc đã nằm trong kế hoạch khác".formatted(p.getCode()));
                }
                if (!Objects.equals(managedSchools.bodyOf(p.getSchool().getId()), bodyId)) {
                    throw new FieldValidationException("proposals",
                            "Đề xuất %s của %s không thuộc cơ quan lập kế hoạch".formatted(p.getCode(),
                                    p.getSchool().getName()));
                }
                p.setPlan(plan);
                // Vào kế hoạch thì mặc định đưa đủ số đề nghị; cơ quan bớt sau trên màn kế hoạch.
                p.getLines().forEach(l -> {
                    l.setPlannedQuantity(l.getQuantity());
                    l.setPlannedUnitPrice(null);
                });
                proposals.persist(p);
            }
        }
        return plan;
    }

    private static void requireSameYear(PurchaseProposal p, ProcurementPlan plan) {
        if (!Objects.equals(p.getBudgetYear(), plan.getBudgetYear())) {
            throw new FieldValidationException("proposals",
                    "Đề xuất %s %s, kế hoạch lập cho năm %d — chỉ đưa vào kế hoạch đề xuất cùng năm ngân sách".formatted(
                            p.getCode() == null ? "#" + p.getId() : p.getCode(), p.getBudgetYear() == null ? "chưa ghi năm ngân sách"
                                    : "xin cho năm ngân sách " + p.getBudgetYear(), plan.getBudgetYear()));
        }
    }

    /** Sửa kế hoạch mà không gửi lại tập dòng: đổi năm học thì đề xuất đang có trong kế hoạch phải cùng năm mới. */
    private void requireProposalsOfYear(ProcurementPlan plan) {
        List<String> other = jdbc.queryForList("""
                SELECT COALESCE(code, '#' || id) FROM purchase_proposals
                WHERE plan_id = ? AND budget_year IS DISTINCT FROM ? ORDER BY id""", String.class, plan.getId(),
                plan.getBudgetYear());
        if (!other.isEmpty()) {
            throw new FieldValidationException("schoolYear",
                    "Kế hoạch đang có đề xuất của năm ngân sách khác (%s%s) — bỏ các đề xuất đó trước khi đổi năm học"
                            .formatted(String.join(", ", other.subList(0, Math.min(3, other.size()))),
                                    other.size() > 3 ? "…" : ""));
        }
    }

    @Transactional
    public ProcurementPlan submit(Long id) {
        ProcurementPlan plan = ownedDraft(id);
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM purchase_proposals WHERE plan_id = ?",
                Integer.class, id);
        if (count == null || count == 0) {
            throw new FieldValidationException("proposals",
                    "Kế hoạch chưa có đề xuất nào. Thêm đề xuất đã duyệt của các trường rồi trình lại.");
        }
        Integer planned = jdbc.queryForObject("""
                SELECT COALESCE(SUM(l.planned_quantity), 0) FROM purchase_proposal_lines l
                JOIN purchase_proposals p ON p.id = l.proposal_id WHERE p.plan_id = ?""", Integer.class, id);
        if (planned == null || planned == 0) {
            throw new FieldValidationException("lines",
                    "Mọi dòng đều đang để 0 — đưa ít nhất một thiết bị vào kế hoạch rồi trình lại.");
        }
        requirePriced(id);
        plan.setStatus(Status.PENDING);
        plan.setApprovalNote(null);
        return repository.save(plan);
    }

    /**
     * Lãnh đạo cơ quan duyệt: đề xuất trong kế hoạch hoàn tất — trừ đề xuất mà MỌI dòng đều để 0 (cơ quan không mua gì
     * của nó). Đề xuất đó rời kế hoạch, về lại "Đã duyệt" (bỏ số / giá kế hoạch như khi rút ra) để vào được kế hoạch sau,
     * kèm một dòng trong quá trình duyệt và thông báo cho trường. Hoàn tất nó thì trường thấy "Hoàn tất" mà không có gì để
     * nhập, và nhu cầu đó không vào được kế hoạch nào nữa.
     */
    @Transactional
    public ProcurementPlan approve(Long id, String note) {
        ProcurementPlan plan = pendingForApprover(id);
        // Kế hoạch trình trước khi có luật này vẫn có thể mang dòng 0 đ — kiểm lại lúc duyệt.
        requirePriced(id);
        plan.setStatus(Status.APPROVED);
        plan.setApprovedAt(Instant.now());
        plan.setApprovedById(CurrentUser.id().orElse(null));
        plan.setApprovalNote(trimToNull(note));
        List<PurchaseProposal> rows = rowLevel.asSystem("procurement_plans.approve",
                () -> proposals.findAll((root, q, cb) -> cb.equal(root.get("plan").get("id"), id)));
        String message = "Đưa vào kế hoạch mua sắm \"%s\" (năm %d) đã được duyệt".formatted(plan.getTitle(),
                plan.getBudgetYear());
        for (PurchaseProposal p : rows) {
            if (p.getStatus() != VoucherStatus.APPROVED) {
                continue;
            }
            if (p.getLines().stream().allMatch(l -> l.effectiveQuantity() == 0)) {
                leavePlan(p, plan);
            } else {
                workflow.complete(p, PurchaseProposalService.RESOURCE, message);
                proposals.persist(p);
            }
        }
        return repository.save(plan);
    }

    /** Đề xuất bị cắt hết (mọi dòng 0) khi kế hoạch được duyệt: ra khỏi kế hoạch, giữ "Đã duyệt", báo trường. */
    private void leavePlan(PurchaseProposal p, ProcurementPlan plan) {
        p.setPlan(null);
        clearPlanned(p);
        String text = ("Không đưa vào kế hoạch mua sắm \"%s\" (năm %d): mọi thiết bị đều để số lượng 0. Đề xuất trở lại"
                + " Đã duyệt, chờ kế hoạch sau.").formatted(plan.getTitle(), plan.getBudgetYear());
        // Không đổi trạng thái — ghi như một lần "trả lại" về hàng chờ kế hoạch, lời nhắn là nội dung.
        workflow.remark(p, PurchaseProposalService.RESOURCE, VoucherEvent.Action.RETURN, text);
        proposals.persist(p);
        Long recipient = p.getSubmittedById() != null ? p.getSubmittedById() : p.getCreatedById();
        if (recipient != null) {
            notifications.notify(NotificationType.VOUCHER_RESULT, recipient, NotificationLevel.WARNING,
                    "Đề xuất mua sắm " + (p.getCode() == null ? "" : p.getCode() + " ") + "chưa được đưa vào kế hoạch",
                    text, "/purchase-proposals/show/" + p.getId());
        }
    }

    /** Bỏ số / giá do kế hoạch đặt: không được theo đề xuất sang kế hoạch sau. */
    private static void clearPlanned(PurchaseProposal p) {
        p.getLines().forEach(l -> {
            l.setPlannedQuantity(null);
            l.setPlannedUnitPrice(null);
        });
    }

    /**
     * Mọi thiết bị đưa vào kế hoạch (số đưa vào > 0) phải có đơn giá dự kiến — kế hoạch là quyết định chi tiền, dự toán
     * 0 đ ("Bằng chữ: Không đồng") thì người duyệt không biết duyệt bao nhiêu. Trường không bắt buộc ghi giá lúc đề
     * xuất; cơ quan nhập đơn giá ngay trên kế hoạch ({@code planned_unit_price}, trống thì theo giá trường ghi).
     */
    private void requirePriced(Long planId) {
        List<String> unpriced = jdbc.queryForList("""
                SELECT p.code || ' · ' || c.name FROM purchase_proposal_lines l
                JOIN purchase_proposals p ON p.id = l.proposal_id
                JOIN equipment_catalogs c ON c.id = l.catalog_id
                WHERE p.plan_id = ? AND COALESCE(l.planned_quantity, 0) > 0
                  AND COALESCE(l.planned_unit_price, l.unit_price, 0) <= 0
                ORDER BY p.code, l.id""", String.class, planId);
        if (!unpriced.isEmpty()) {
            throw new FieldValidationException("lines", "Nhập đơn giá cho %d thiết bị trước khi trình / duyệt kế hoạch (%s%s)"
                    .formatted(unpriced.size(), String.join("; ", unpriced.subList(0, Math.min(3, unpriced.size()))),
                            unpriced.size() > 3 ? "…" : ""));
        }
    }

    @Transactional
    public ProcurementPlan returnToDraft(Long id, String note) {
        String reason = trimToNull(note);
        if (reason == null) {
            throw new FieldValidationException("note", "Ghi lý do trả lại để chuyên viên biết phải sửa gì");
        }
        ProcurementPlan plan = pendingForApprover(id);
        plan.setStatus(Status.DRAFT);
        plan.setApprovalNote(reason);
        return repository.save(plan);
    }

    public boolean canManage(ProcurementPlan plan) {
        return principals.current()
                .map(p -> isAdmin(p) || Objects.equals(p.managingBodyId(), plan.getManagingBody().getId()))
                .orElse(false);
    }

    /** Các nút người gọi bấm được trên kế hoạch này. */
    @Transactional(propagation = Propagation.SUPPORTS)
    public Set<String> actions(ProcurementPlan plan) {
        Set<String> actions = new LinkedHashSet<>();
        boolean manage = canManage(plan);
        if (plan.getStatus() == Status.DRAFT && manage && CurrentUser.has("procurement_plans:write")) {
            actions.add("edit");
            actions.add("submit");
        }
        if (plan.getStatus() == Status.DRAFT && manage && CurrentUser.has("procurement_plans:delete")) {
            actions.add("delete");
        }
        if (plan.getStatus() == Status.PENDING && manage && CurrentUser.has("procurement_plans:approve")) {
            actions.add("approve");
            actions.add("return");
        }
        return actions;
    }

    // ------------------------------------------------------------------ nội bộ

    private List<CatalogTotal> totals(List<PurchaseProposal> rows) {
        Map<Long, CatalogTotal> totals = new LinkedHashMap<>();
        Map<Long, Set<Long>> schools = new LinkedHashMap<>();
        for (PurchaseProposal p : rows) {
            for (var l : p.getLines()) {
                var c = l.getCatalog();
                // Dòng cơ quan bỏ (0) không tính trường đó vào "số trường" của thiết bị.
                if (l.effectiveQuantity() == 0) {
                    continue;
                }
                schools.computeIfAbsent(c.getId(), k -> new HashSet<>()).add(p.getSchool().getId());
                CatalogTotal prev = totals.get(c.getId());
                BigDecimal amount = l.plannedAmount();
                totals.put(c.getId(), new CatalogTotal(c.getId(), c.getCode(), c.getName(), l.getUnitName(),
                        (prev == null ? 0 : prev.quantity()) + l.effectiveQuantity(),
                        (prev == null ? BigDecimal.ZERO : prev.amount()).add(amount), 0));
            }
        }
        List<CatalogTotal> result = new ArrayList<>();
        for (CatalogTotal t : totals.values()) {
            result.add(new CatalogTotal(t.catalogId(), t.catalogCode(), t.catalogName(), t.unitName(), t.quantity(),
                    t.amount(), schools.get(t.catalogId()).size()));
        }
        result.sort((a, b) -> b.amount().compareTo(a.amount()));
        return result;
    }

    private Specification<ProcurementPlan> visible() {
        RowLevelPrincipal principal = principals.current().orElse(null);
        return (root, q, cb) -> {
            if (principal == null) {
                return cb.disjunction();
            }
            if (isAdmin(principal) || visibleSchools.isCityBody(principal.managingBodyId())) {
                return cb.conjunction();
            }
            if (principal.schoolId() != null) {
                // Trường: chỉ kế hoạch đã duyệt mà có đề xuất của chính trường đó.
                Subquery<Long> own = q.subquery(Long.class);
                Root<PurchaseProposal> proposal = own.from(PurchaseProposal.class);
                own.select(proposal.get("id")).where(
                        cb.equal(proposal.get("plan").get("id"), root.get("id")),
                        cb.equal(proposal.get("school").get("id"), principal.schoolId()));
                return cb.and(cb.equal(root.get("status"), Status.APPROVED), cb.exists(own));
            }
            if (principal.managingBodyId() == null) {
                return cb.disjunction();
            }
            return cb.equal(root.get("managingBody").get("id"), principal.managingBodyId());
        };
    }

    private ProcurementPlan ownedDraft(Long id) {
        ProcurementPlan plan = get(id);
        if (!canManage(plan)) {
            throw new FieldValidationException("managingBody", "Chỉ cơ quan lập kế hoạch mới sửa được kế hoạch này");
        }
        if (plan.getStatus() != Status.DRAFT) {
            throw new FieldValidationException("status", "Chỉ sửa được kế hoạch nháp");
        }
        return plan;
    }

    private ProcurementPlan pendingForApprover(Long id) {
        ProcurementPlan plan = get(id);
        if (!canManage(plan)) {
            throw new FieldValidationException("managingBody",
                    "Chỉ lãnh đạo của cơ quan lập kế hoạch mới duyệt được kế hoạch này");
        }
        if (plan.getStatus() != Status.PENDING) {
            throw new FieldValidationException("status", "Kế hoạch không ở trạng thái chờ duyệt");
        }
        return plan;
    }

    private DepartmentOfEducation ownBody(Long requested) {
        RowLevelPrincipal principal = principals.current().orElseThrow();
        Long body = principal.managingBodyId();
        if (body == null && isAdmin(principal)) {
            body = requested;
        }
        if (body == null) {
            throw new FieldValidationException("managingBody", "Chỉ tài khoản thuộc Sở mới lập được kế hoạch mua sắm");
        }
        Long bodyId = body;
        return rowLevel.asSystem("procurement_plans.body", () -> bodies.get(bodyId));
    }

    private static boolean isAdmin(RowLevelPrincipal principal) {
        return principal.roleCodes().contains("ADMIN");
    }

    private void apply(ProcurementPlan plan, Input input) {
        if (input.title() != null && !input.title().isBlank()) {
            plan.setTitle(input.title().trim());
        }
        if (input.schoolYearId() != null) {
            // Năm học quyết định năm ngân sách: năm kết thúc của năm học (2026-2027 → 2027).
            var year = schoolYears.get(input.schoolYearId());
            plan.setSchoolYear(year);
            plan.setBudgetYear(year.getEndDate().getYear());
        } else if (input.budgetYear() != null) {
            plan.setBudgetYear(input.budgetYear());
        }
        if (input.note() != null) {
            plan.setNote(trimToNull(input.note()));
        }
        if (plan.getTitle() == null || plan.getBudgetYear() == null) {
            throw new FieldValidationException("title", "Nhập tên kế hoạch và chọn năm học");
        }
        if (plan.getBudgetYear() < 2000 || plan.getBudgetYear() > 2100) {
            throw new FieldValidationException("budgetYear", "Năm ngân sách không hợp lệ");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
