package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherEvent.Action;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.system.approvalflow.ApprovalFlowService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Vòng duyệt dùng chung cho mọi loại phiếu: trình, duyệt từng cấp, trả lại, từ chối, huỷ, hoàn tất —
 * và ghi mỗi bước vào {@code voucher_events}.
 *
 * <p>Cái nó KHÔNG làm là tác động lên tài sản. Duyệt xong một phiếu nhập thì ghi tăng thiết bị — đó
 * là việc của service từng loại phiếu ({@link VoucherService#onApproved}). Tách như vậy để mọi loại
 * phiếu có chung MỘT luật "ai được duyệt bước nào", và luật đó nằm ở đúng một chỗ.
 *
 * <p><b>Ai được duyệt</b> là giao của hai điều kiện, và cả hai đều cần:
 * <ol>
 *   <li>mã quyền {@code <loại phiếu>:approve} — kiểm ở controller;</li>
 *   <li>tài khoản thuộc đúng CẤP của bước đang chờ ({@link ApprovalStep}) — kiểm ở đây.</li>
 * </ol>
 *
 * <p><b>Mỗi bước duyệt có ba kết quả</b>: đồng ý (sang bước sau, hoặc xong), trả lại (về nháp, người
 * lập sửa rồi trình lại — phiếu vẫn còn), từ chối (phiếu dừng hẳn). Trả lại và từ chối BẮT BUỘC có
 * lời nhắn.
 */
@Component
public class VoucherWorkflow {

    private final VoucherEventRepository events;
    private final DocumentNumberService numbers;
    private final RowLevelPrincipalResolver principals;
    private final ManagedSchoolsCache managedSchools;
    private final JdbcTemplate jdbc;
    private final ApprovalFlowService approvalFlows;
    private final ApplicationEventPublisher publisher;

    public VoucherWorkflow(
            VoucherEventRepository events,
            DocumentNumberService numbers,
            RowLevelPrincipalResolver principals,
            ManagedSchoolsCache managedSchools,
            JdbcTemplate jdbc,
            ApprovalFlowService approvalFlows,
            ApplicationEventPublisher publisher) {
        this.events = events;
        this.numbers = numbers;
        this.principals = principals;
        this.managedSchools = managedSchools;
        this.jdbc = jdbc;
        this.approvalFlows = approvalFlows;
        this.publisher = publisher;
    }

    // ------------------------------------------------------------------ chuyển trạng thái

    /**
     * Trình phiếu. Cấp số phiếu nếu chưa có, rồi đặt bước chờ duyệt đầu tiên.
     *
     * @return {@code true} khi phiếu không cần ai duyệt — đã {@code APPROVED} ngay, và service phải
     *         làm tiếp việc của lần duyệt cuối
     */
    public boolean submit(SchoolVoucher voucher) {
        require(voucher, VoucherStatus.DRAFT, "trình");
        if (voucher.getCode() == null) {
            voucher.setCode(numbers.reserve(voucher.getSchool(), voucher.numberPrefix(), voucher.documentDate()));
        }
        VoucherStatus from = voucher.getStatus();
        voucher.setSubmittedAt(Instant.now());
        voucher.setSubmittedById(CurrentUser.id().orElse(null));
        voucher.setRejectReason(null);

        ApprovalStep first = nextStep(voucher, null);
        voucher.setApprovalStep(first);
        voucher.setStatus(first == null ? VoucherStatus.APPROVED : VoucherStatus.PENDING);
        record(voucher, Action.SUBMIT, from, null, null);
        return first == null;
    }

    /**
     * Duyệt bước đang chờ.
     *
     * @return {@code true} khi đây là bước CUỐI — phiếu thành {@code APPROVED} và service làm tiếp
     *         việc của nó
     */
    public boolean approve(SchoolVoucher voucher, String note) {
        require(voucher, VoucherStatus.PENDING, "duyệt");
        requireTier(voucher);
        ApprovalStep step = voucher.getApprovalStep();
        ApprovalStep next = nextStep(voucher, step);
        if (next != null) {
            voucher.setApprovalStep(next);
            record(voucher, Action.APPROVE, VoucherStatus.PENDING, step, trimToNull(note));
            return false;
        }
        voucher.setApprovalStep(null);
        voucher.setStatus(VoucherStatus.APPROVED);
        record(voucher, Action.APPROVE, VoucherStatus.PENDING, step, trimToNull(note));
        return true;
    }

    /** Trả về người lập để sửa. Phiếu về nháp, số phiếu giữ nguyên. */
    public void returnToDraft(SchoolVoucher voucher, String note) {
        require(voucher, VoucherStatus.PENDING, "trả lại");
        requireTier(voucher);
        String message = requireNote(note, "Ghi rõ cần sửa gì trước khi trả lại");
        ApprovalStep step = voucher.getApprovalStep();
        voucher.setApprovalStep(null);
        voucher.setStatus(VoucherStatus.DRAFT);
        voucher.setReturnNote(message);
        record(voucher, Action.RETURN, VoucherStatus.PENDING, step, message);
        decided(voucher, VoucherDecided.Decision.RETURNED, message);
    }

    /** Từ chối: phiếu dừng hẳn, tài sản giữ nguyên như trước khi lập phiếu. */
    public void reject(SchoolVoucher voucher, String reason) {
        require(voucher, VoucherStatus.PENDING, "từ chối");
        requireTier(voucher);
        String message = requireNote(reason, "Ghi lý do từ chối");
        ApprovalStep step = voucher.getApprovalStep();
        voucher.setApprovalStep(null);
        voucher.setStatus(VoucherStatus.REJECTED);
        voucher.setRejectReason(message);
        record(voucher, Action.REJECT, VoucherStatus.PENDING, step, message);
        decided(voucher, VoucherDecided.Decision.REJECTED, message);
    }

    /** Người lập tự bỏ một phiếu nháp. */
    public void cancel(SchoolVoucher voucher, String reason) {
        require(voucher, VoucherStatus.DRAFT, "huỷ");
        voucher.setStatus(VoucherStatus.CANCELLED);
        voucher.setCancelReason(trimToNull(reason));
        record(voucher, Action.CANCEL, VoucherStatus.DRAFT, null, trimToNull(reason));
    }

    /** Hoàn tất: thời điểm phiếu tác động lên sổ tài sản. */
    public void complete(SchoolVoucher voucher, String note) {
        require(voucher, VoucherStatus.APPROVED, "hoàn tất");
        voucher.setStatus(VoucherStatus.COMPLETED);
        voucher.setCompletedAt(Instant.now());
        voucher.setCompletedById(CurrentUser.id().orElse(null));
        record(voucher, Action.COMPLETE, VoucherStatus.APPROVED, null, trimToNull(note));
    }

    /** Phiếu chưa từng được trình thì xoá được; đã có nhật ký duyệt thì không. */
    public void requireDeletable(SchoolVoucher voucher) {
        if (voucher.getStatus() != VoucherStatus.DRAFT && voucher.getStatus() != VoucherStatus.CANCELLED) {
            throw new FieldValidationException("status", "Chỉ xoá được phiếu nháp hoặc phiếu đã huỷ");
        }
        if (voucher.getCode() != null || events.existsByResourceAndVoucherId(voucher.resource(), voucher.getId())) {
            throw new FieldValidationException("status",
                    "Phiếu đã từng được trình, không xoá được — nó đã có số và nhật ký duyệt. Hãy huỷ phiếu");
        }
    }

    // ------------------------------------------------------------------ ai làm được gì

    /**
     * Các hành động người đang gọi làm được trên phiếu này, để màn chi tiết chỉ hiện đúng những nút có
     * tác dụng ({@code _actions} trong DTO).
     *
     * @param canWrite   phiếu nằm trong phạm vi GHI của người gọi và người gọi có mã {@code :write}
     * @param canApprove người gọi có mã quyền {@code :approve} của loại phiếu
     */
    public Set<String> actions(SchoolVoucher voucher, boolean canWrite, boolean canApprove) {
        Set<String> actions = new LinkedHashSet<>();
        switch (voucher.getStatus()) {
            case DRAFT -> {
                if (canWrite) {
                    actions.add("edit");
                    if (!approvesOwnSubmission(voucher, canApprove)) {
                        actions.add("submit");
                        // Phiếu không qua cấp duyệt nào: bấm là hệ thống ghi nhận ngay. Dấu này để màn
                        // hình gọi nút là "Duyệt" thay vì "Trình".
                        if (nextStep(voucher, null) == null) {
                            actions.add("submit_direct");
                        }
                    }
                    actions.add("cancel");
                    if (voucher.getCode() == null) {
                        actions.add("delete");
                    }
                }
            }
            case PENDING -> {
                if (canApprove && inTier(voucher)) {
                    actions.add("approve");
                    actions.add("return");
                    actions.add("reject");
                }
            }
            case APPROVED -> {
                if (canWrite) {
                    actions.add("complete");
                }
            }
            case CANCELLED -> {
                if (canWrite && voucher.getCode() == null) {
                    actions.add("delete");
                }
            }
            default -> {
            }
        }
        return actions;
    }

    /**
     * Người gọi chính là người DUYỆT bước đầu của phiếu này — lãnh đạo của trường lập phiếu. Trình là
     * việc của người lập gửi lên cho họ; một nút "Trình" trên màn của người duyệt là tự trình cho mình.
     * Phiếu không cần ai duyệt và quản trị viên thì không áp dụng.
     */
    private boolean approvesOwnSubmission(SchoolVoucher voucher, boolean canApprove) {
        if (!canApprove || nextStep(voucher, null) != ApprovalStep.SCHOOL) {
            return false;
        }
        Optional<RowLevelPrincipal> current = principals.current();
        return current.isPresent()
                && !isAdmin(current.get())
                && Objects.equals(current.get().schoolId(), voucher.getSchool().getId());
    }

    /** Người đang gọi thuộc đúng cấp của bước đang chờ. */
    public boolean inTier(SchoolVoucher voucher) {
        if (voucher.getApprovalStep() == null) {
            return false;
        }
        Optional<RowLevelPrincipal> current = principals.current();
        if (current.isEmpty()) {
            return false;
        }
        RowLevelPrincipal principal = current.get();
        if (isAdmin(principal)) {
            return true;
        }
        return switch (voucher.getApprovalStep()) {
            case SCHOOL -> Objects.equals(principal.schoolId(), voucher.getSchool().getId());
            case MANAGING_BODY -> principal.managingBodyId() != null
                    && Objects.equals(principal.managingBodyId(), bodyId(voucher.getSchool()));
        };
    }

    /** Bộ lọc "phiếu đang chờ TÔI duyệt": trạng thái chờ duyệt, ở đúng bước mà cấp của tài khoản duyệt được. */
    public <T extends SchoolVoucher> Specification<T> awaitingMe() {
        Optional<RowLevelPrincipal> current = principals.current();
        return (root, query, cb) -> {
            Predicate pending = cb.equal(root.get("status"), VoucherStatus.PENDING);
            if (current.isEmpty()) {
                return cb.disjunction();
            }
            RowLevelPrincipal principal = current.get();
            if (isAdmin(principal)) {
                return pending;
            }
            List<Predicate> mine = new ArrayList<>();
            if (principal.schoolId() != null) {
                mine.add(cb.and(cb.equal(root.get("approvalStep"), ApprovalStep.SCHOOL),
                        cb.equal(root.get("school").get("id"), principal.schoolId())));
            }
            Set<Long> managed = managedSchools.schoolsOf(principal.managingBodyId());
            if (!managed.isEmpty()) {
                mine.add(cb.and(cb.equal(root.get("approvalStep"), ApprovalStep.MANAGING_BODY),
                        root.get("school").get("id").in(managed)));
            }
            if (mine.isEmpty()) {
                return cb.disjunction();
            }
            return cb.and(pending, cb.or(mine.toArray(Predicate[]::new)));
        };
    }

    public List<VoucherEvent> history(String resource, Long voucherId) {
        return events.findByResourceAndVoucherIdOrderByCreatedAtAscIdAsc(resource, voucherId);
    }

    // ------------------------------------------------------------------ nội bộ

    /**
     * Bước kế tiếp sau {@code current} trong chuỗi duyệt của phiếu.
     *
     * <p>Bỏ qua bước không có ai để duyệt: trường chưa gán cơ quan quản lý thì không có bước cơ quan
     * quản lý. "Sau" nghĩa là CẤP cao hơn cấp hiện tại (chuỗi luôn xếp theo thứ tự cấp), không phải
     * "vị trí sau trong danh sách": chuỗi có thể bị cấu hình lại trong lúc phiếu đang chờ.
     */
    private ApprovalStep nextStep(SchoolVoucher voucher, ApprovalStep current) {
        for (ApprovalStep step : approvalFlows.chainOf(voucher)) {
            if (current != null && step.ordinal() <= current.ordinal()) {
                continue;
            }
            if (step == ApprovalStep.MANAGING_BODY && bodyId(voucher.getSchool()) == null) {
                continue;
            }
            return step;
        }
        return null;
    }

    private void decided(SchoolVoucher voucher, VoucherDecided.Decision decision, String message) {
        Long recipient = voucher.getSubmittedById() != null ? voucher.getSubmittedById() : voucher.getCreatedById();
        publisher.publishEvent(new VoucherDecided(voucher.resource(), voucher.getId(), voucher.getCode(), decision,
                message, recipient));
    }

    private void requireTier(SchoolVoucher voucher) {
        if (!inTier(voucher)) {
            throw new FieldValidationException("approvalStep",
                    "Phiếu đang chờ %s duyệt — tài khoản của bạn không thuộc cấp này"
                            .formatted(voucher.getApprovalStep().label()));
        }
    }

    private static void require(SchoolVoucher voucher, VoucherStatus expected, String action) {
        if (voucher.getStatus() == expected) {
            return;
        }
        throw new FieldValidationException("status",
                "Phiếu đang ở trạng thái \"%s\", không %s được".formatted(voucher.getStatus().label(), action));
    }

    private void record(SchoolVoucher voucher, Action action, VoucherStatus from, ApprovalStep step, String note) {
        Long actorId = CurrentUser.id().orElse(null);
        events.save(new VoucherEvent(voucher.resource(), voucher.getId(), action, from, voucher.getStatus(), step,
                note, actorId, actorName(actorId)));
    }

    private String actorName(Long actorId) {
        if (actorId == null) {
            return null;
        }
        List<String> names = jdbc.queryForList(
                "SELECT COALESCE(NULLIF(full_name, ''), username) FROM users WHERE id = ?", String.class, actorId);
        return names.isEmpty() ? null : names.get(0);
    }

    private static boolean isAdmin(RowLevelPrincipal principal) {
        return principal.roleCodes().contains("ADMIN");
    }

    private static Long bodyId(School school) {
        if (school == null) {
            return null;
        }
        DepartmentOfEducation body = school.getDepartmentOfEducation();
        return body == null ? null : body.getId();
    }

    private static String requireNote(String note, String message) {
        String trimmed = trimToNull(note);
        if (trimmed == null) {
            throw new FieldValidationException("note", message);
        }
        return trimmed;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
