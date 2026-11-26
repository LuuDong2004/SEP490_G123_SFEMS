package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.ApprovalFlowType;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.system.approvalflow.ApprovalFlowService;
import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ai duyệt được bước đang chờ của một phiếu — MỘT luật cho cả thông báo "phiếu chờ duyệt" ({@link VoucherProgressNotifier})
 * lẫn dòng "Người duyệt" trên màn chi tiết phiếu.
 *
 * <p>Cùng luật với {@link VoucherWorkflow#inTier} cộng mã quyền {@code <loại phiếu>:approve}: bước TRƯỜNG — tài khoản của
 * trường đó (lãnh đạo một cơ sở chỉ khi phiếu chỉ chạm cơ sở của mình); bước SỞ — tài khoản của Sở quản lý trường. Chỉ
 * tài khoản đang hoạt động.
 */
@Component
public class VoucherApprovers {

    private static final String APPROVERS = """
            SELECT DISTINCT u.id FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN role_permissions rp ON rp.role_id = ur.role_id
            JOIN permissions p ON p.id = rp.permission_id
            LEFT JOIN user_schools us ON us.id = u.id
            LEFT JOIN (SELECT id, managing_body_id FROM user_sos) ag ON ag.id = u.id
            WHERE p.code = ? AND u.status = 'ACTIVE' AND\s""";

    private final JdbcTemplate jdbc;
    private final EntityManager em;
    private final VoucherCampus campus;
    private final VoucherEventRepository events;
    private final ApprovalFlowService flows;

    public VoucherApprovers(JdbcTemplate jdbc, EntityManager em, VoucherCampus campus, VoucherEventRepository events,
            ApprovalFlowService flows) {
        this.jdbc = jdbc;
        this.em = em;
        this.campus = campus;
        this.events = events;
        this.flows = flows;
    }

    /** Id tài khoản duyệt được bước {@code step} của phiếu loại {@code resource} thuộc trường {@code schoolId}. */
    public List<Long> of(String resource, ApprovalStep step, Long schoolId, Set<Long> campuses) {
        if (step == null || schoolId == null) {
            return List.of();
        }
        String permission = resource + ":approve";
        return switch (step) {
            case SCHOOL -> campuses.size() == 1
                    ? jdbc.queryForList(APPROVERS + "us.school_id = ? AND (us.campus_id IS NULL OR us.campus_id = ?)",
                            Long.class, permission, schoolId, campuses.iterator().next())
                    : jdbc.queryForList(APPROVERS + "us.school_id = ? AND us.campus_id IS NULL", Long.class, permission,
                            schoolId);
            case MANAGING_BODY -> jdbc.queryForList(APPROVERS
                    + "ag.managing_body_id = (SELECT s.department_of_education_id FROM schools s WHERE s.id = ?)",
                    Long.class, permission, schoolId);
        };
    }

    /**
     * Người duyệt của phiếu lúc này. Đang chờ duyệt: những người duyệt được bước đang chờ ({@code pending = true}).
     * Phiếu nháp: những người sẽ duyệt bước đầu khi trình ({@code upcoming = true}). Đã qua duyệt (đã duyệt, hoàn tất,
     * bị từ chối): những người đã quyết ở lần trình gần nhất, theo thứ tự bước. Đã huỷ: rỗng.
     */
    @Transactional(readOnly = true)
    public Current current(String resource, Long voucherId) {
        ApprovalFlowType type = ApprovalFlowType.of(resource).orElse(null);
        SchoolVoucher voucher = type == null ? null : em.find(type.entity(), voucherId);
        if (voucher == null || voucher.getStatus() == VoucherStatus.CANCELLED) {
            return new Current(null, false, false, List.of());
        }
        if (voucher.getStatus() == VoucherStatus.PENDING && voucher.getApprovalStep() != null) {
            return new Current(voucher.getApprovalStep(), true, false, waiting(resource, voucher, voucher.getApprovalStep()));
        }
        if (voucher.getStatus() == VoucherStatus.DRAFT) {
            List<ApprovalStep> chain = flows.chainOf(voucher);
            ApprovalStep first = chain.isEmpty() ? null : chain.get(0);
            return first == null ? new Current(null, false, false, List.of())
                    : new Current(first, false, true, waiting(resource, voucher, first));
        }
        // Lần trình gần nhất: các quyết định (duyệt, từ chối) sau lần SUBMIT cuối cùng.
        List<VoucherEvent> history = events.findByResourceAndVoucherIdOrderByCreatedAtAscIdAsc(resource, voucherId);
        List<Person> decided = new ArrayList<>();
        for (VoucherEvent e : history) {
            if (e.getAction() == VoucherEvent.Action.SUBMIT) {
                decided.clear();
            } else if ((e.getAction() == VoucherEvent.Action.APPROVE || e.getAction() == VoucherEvent.Action.REJECT)
                    && e.getActorName() != null) {
                decided.add(new Person(e.getStep(), e.getActorName()));
            }
        }
        return new Current(null, false, false, decided);
    }

    private List<Person> waiting(String resource, SchoolVoucher voucher, ApprovalStep step) {
        Set<Long> campuses = step == ApprovalStep.SCHOOL ? campus.touchedCampuses(voucher) : Set.of();
        List<Long> ids = of(resource, step, voucher.getSchool() == null ? null : voucher.getSchool().getId(), campuses);
        return names(ids).stream().map(n -> new Person(step, n)).toList();
    }

    private List<String> names(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.queryForList("SELECT COALESCE(NULLIF(full_name, ''), username) FROM users WHERE id = ANY (?) ORDER BY 1",
                String.class, (Object) ids.toArray(Long[]::new));
    }

    /** Một người duyệt và bước của họ. */
    public record Person(ApprovalStep step, String name) {
    }

    /** {@code step}: bước đang chờ ({@code pending}) hoặc bước đầu khi trình ({@code upcoming}, phiếu nháp). */
    public record Current(ApprovalStep step, boolean pending, boolean upcoming, List<Person> people) {
    }
}
