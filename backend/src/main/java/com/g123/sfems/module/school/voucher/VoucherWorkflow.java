package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherEvent.Action;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.system.approvalflow.ApprovalFlowService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
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
import com.g123.sfems.module.school.voucher.VoucherDecisionNotifier.VoucherDecided;
import com.g123.sfems.module.school.voucher.VoucherDecisionNotifier.VoucherDecided.Decision;
import com.g123.sfems.module.school.voucher.VoucherProgressNotifier.VoucherApproved;
import com.g123.sfems.module.school.voucher.VoucherProgressNotifier.VoucherAwaiting;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Vòng duyệt dùng chung cho mọi loại phiếu: trình, duyệt từng cấp, trả lại, từ
 * chối, huỷ, hoàn tất — và ghi mỗi bước vào {@code voucher_events}.
 *
 * <p>Cái nó KHÔNG làm là tác động lên tài sản. Duyệt xong một phiếu nhập thì
 * sinh tài sản, duyệt xong biên bản kiểm kê thì ghi kết quả vào hồ sơ thiết bị
 * — đó là việc của service từng loại phiếu, gọi ngay sau khi {@link #approve}
 * báo bước duyệt cuối cùng đã qua. Tách như vậy để các loại phiếu có chung MỘT
 * luật "ai được duyệt bước nào", và luật đó nằm ở đúng một chỗ.
 *
 * <p><b>Ai được duyệt</b> là giao của hai điều kiện, và cả hai đều cần:
 * <ol>
 *   <li>mã quyền {@code <loại phiếu>:approve} — kiểm ở controller;</li>
 *   <li>tài khoản thuộc đúng CẤP của bước đang chờ ({@link ApprovalStep}) —
 *       kiểm ở đây. Lãnh đạo UBND phường A có mã quyền duyệt, nhưng không duyệt
 *       được phiếu của trường thuộc phường B.</li>
 * </ol>
 * Chỉ có mã quyền thì một lãnh đạo trường duyệt được phiếu của trường khác; chỉ
 * có cấp thì cán bộ thiết bị — cũng thuộc trường — tự duyệt phiếu mình lập.
 *
 * <p><b>Mỗi bước duyệt có ba kết quả</b>: đồng ý (sang bước sau, hoặc xong),
 * trả lại (về nháp, người lập sửa rồi trình lại — phiếu vẫn còn), từ chối (phiếu
 * dừng hẳn). Trả lại và từ chối BẮT BUỘC có lời nhắn: một phiếu bị trả về không
 * kèm lý do là một phiếu sẽ được trình lại y nguyên.
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
    private final InventoryFreeze inventoryFreeze;

    public VoucherWorkflow(
            VoucherEventRepository events,
            DocumentNumberService numbers,
            RowLevelPrincipalResolver principals,
            ManagedSchoolsCache managedSchools,
            JdbcTemplate jdbc,
            ApprovalFlowService approvalFlows,
            ApplicationEventPublisher publisher,
            InventoryFreeze inventoryFreeze) {
        this.events = events;
        this.numbers = numbers;
        this.principals = principals;
        this.managedSchools = managedSchools;
        this.jdbc = jdbc;
        this.approvalFlows = approvalFlows;
        this.publisher = publisher;
        this.inventoryFreeze = inventoryFreeze;
    }

    // ------------------------------------------------------------------ chuyển trạng thái

    /**
     * Trình phiếu. Cấp số phiếu nếu chưa có, rồi đặt bước chờ duyệt đầu tiên.
     *
     * @return {@code true} khi phiếu không cần ai duyệt — đã {@code APPROVED}
     *         ngay, và service phải làm tiếp việc của lần duyệt cuối
     */
    public boolean submit(SchoolVoucher voucher, String resource) {
        require(voucher, VoucherStatus.DRAFT, "trình");
        // Đang kiểm kê thì số liệu khoá — một chỗ cho mọi loại phiếu đi qua vòng duyệt chung.
        inventoryFreeze.requireNotFrozen(resource, voucher.getId());
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
        record(voucher, resource, Action.SUBMIT, from, null, null);
        if (first != null) {
            awaiting(voucher, resource, first);
        }
        return first == null;
    }

    /**
     * Duyệt bước đang chờ.
     *
     * @return {@code true} khi đây là bước CUỐI — phiếu thành {@code APPROVED}
     *         và service làm tiếp việc của nó
     */
    public boolean approve(SchoolVoucher voucher, String resource, String note) {
        require(voucher, VoucherStatus.PENDING, "duyệt");
        requireTier(voucher);
        inventoryFreeze.requireNotFrozen(resource, voucher.getId());
        ApprovalStep step = voucher.getApprovalStep();
        ApprovalStep next = nextStep(voucher, step);
        if (next != null) {
            voucher.setApprovalStep(next);
            record(voucher, resource, Action.APPROVE, VoucherStatus.PENDING, step, trimToNull(note));
            awaiting(voucher, resource, next);
            return false;
        }
        voucher.setApprovalStep(null);
        voucher.setStatus(VoucherStatus.APPROVED);
        record(voucher, resource, Action.APPROVE, VoucherStatus.PENDING, step, trimToNull(note));
        Long submitter = voucher.getSubmittedById() != null ? voucher.getSubmittedById() : voucher.getCreatedById();
        publisher.publishEvent(new VoucherApproved(resource, voucher.getId(), voucher.getCode(), submitter));
        return true;
    }

    /** Trả về người lập để sửa. Phiếu về nháp, số phiếu giữ nguyên. */
    public void returnToDraft(SchoolVoucher voucher, String resource, String note) {
        require(voucher, VoucherStatus.PENDING, "trả lại");
        requireTier(voucher);
        String message = requireNote(note, "Ghi rõ cần sửa gì trước khi trả lại");
        ApprovalStep step = voucher.getApprovalStep();
        voucher.setApprovalStep(null);
        voucher.setStatus(VoucherStatus.DRAFT);
        voucher.setReturnNote(message);
        record(voucher, resource, Action.RETURN, VoucherStatus.PENDING, step, message);
        decided(voucher, resource, Decision.RETURNED, message);
    }

    /** Từ chối: phiếu dừng hẳn, tài sản giữ nguyên như trước khi lập phiếu. */
    public void reject(SchoolVoucher voucher, String resource, String reason) {
        require(voucher, VoucherStatus.PENDING, "từ chối");
        requireTier(voucher);
        String message = requireNote(reason, "Ghi lý do từ chối");
        ApprovalStep step = voucher.getApprovalStep();
        voucher.setApprovalStep(null);
        voucher.setStatus(VoucherStatus.REJECTED);
        voucher.setRejectReason(message);
        record(voucher, resource, Action.REJECT, VoucherStatus.PENDING, step, message);
        decided(voucher, resource, Decision.REJECTED, message);
    }

    /** Báo những người duyệt được bước {@code step} — xem {@link VoucherProgressNotifier}. */
    private void awaiting(SchoolVoucher voucher, String resource, ApprovalStep step) {
        School school = voucher.getSchool();
        publisher.publishEvent(new VoucherAwaiting(resource, voucher.getId(), voucher.getCode(), step,
                school == null ? null : school.getId(), school == null ? "" : school.getName()));
    }

    /** Báo người trình (không có thì người lập), xem {@link VoucherDecisionNotifier}. */
    private void decided(SchoolVoucher voucher, String resource, Decision decision, String message) {
        Long recipient = voucher.getSubmittedById() != null ? voucher.getSubmittedById() : voucher.getCreatedById();
        publisher.publishEvent(new VoucherDecided(resource, voucher.getId(), voucher.getCode(), decision, message,
                recipient));
    }

    /** Người lập tự bỏ một phiếu nháp. */
    public void cancel(SchoolVoucher voucher, String resource, String reason) {
        require(voucher, VoucherStatus.DRAFT, "huỷ");
        voucher.setStatus(VoucherStatus.CANCELLED);
        voucher.setCancelReason(trimToNull(reason));
        record(voucher, resource, Action.CANCEL, VoucherStatus.DRAFT, null, trimToNull(reason));
    }

    /** Hoàn tất: thời điểm phiếu tác động lên sổ tài sản. */
    public void complete(SchoolVoucher voucher, String resource, String note) {
        require(voucher, VoucherStatus.APPROVED, "hoàn tất");
        voucher.setStatus(VoucherStatus.COMPLETED);
        voucher.setCompletedAt(Instant.now());
        voucher.setCompletedById(CurrentUser.id().orElse(null));
        record(voucher, resource, Action.COMPLETE, VoucherStatus.APPROVED, null, trimToNull(note));
    }

    /** Phiếu chưa từng được trình thì xoá được; đã có nhật ký duyệt thì không. */
    public void requireDeletable(SchoolVoucher voucher, String resource) {
        if (voucher.getStatus() != VoucherStatus.DRAFT && voucher.getStatus() != VoucherStatus.CANCELLED) {
            throw new FieldValidationException("status", "Chỉ xoá được phiếu nháp hoặc phiếu đã huỷ");
        }
        if (voucher.getCode() != null || events.existsByResourceAndVoucherId(resource, voucher.getId())) {
            throw new FieldValidationException("status",
                    "Phiếu đã từng được trình, không xoá được — nó đã có số và nhật ký duyệt. Hãy huỷ phiếu");
        }
    }

    // ------------------------------------------------------------------ ai làm được gì

    /**
     * Các hành động người đang gọi làm được trên phiếu này, để màn chi tiết chỉ
     * hiện đúng những nút có tác dụng.
     *
     * @param canWrite     phiếu nằm trong phạm vi GHI của người gọi
     * @param canApprove   người gọi có mã quyền {@code :approve} của loại phiếu
     */
    public Set<String> actions(SchoolVoucher voucher, boolean canWrite, boolean canApprove) {
        Set<String> actions = new LinkedHashSet<>();
        switch (voucher.getStatus()) {
            case DRAFT -> {
                if (canWrite) {
                    actions.add("edit");
                    if (!approvesOwnSubmission(voucher, canApprove)) {
                        actions.add("submit");
                        // Phiếu không qua cấp duyệt nào: bấm là hệ thống ghi nhận và khoá phiếu ngay. Dấu
                        // này để màn hình gọi nút là "Duyệt" thay vì "Trình" — không ai chờ duyệt cả.
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
     * việc của người lập gửi lên cho họ; một nút "Trình" trên màn của người duyệt là tự trình cho
     * mình. Phiếu không cần ai duyệt (trình = xong) và quản trị viên thì không áp dụng.
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
        // Quản trị viên không thuộc cấp duyệt nào (284): duyệt là quyết định của lãnh đạo trường / Sở.
        RowLevelPrincipal principal = current.get();
        return switch (voucher.getApprovalStep()) {
            case SCHOOL -> Objects.equals(principal.schoolId(), voucher.getSchool().getId());
            case MANAGING_BODY -> principal.managingBodyId() != null
                    && Objects.equals(principal.managingBodyId(), bodyId(voucher.getSchool()));
        };
    }

    /**
     * Bộ lọc "phiếu đang chờ TÔI duyệt": trạng thái chờ duyệt, ở đúng bước mà
     * cấp của tài khoản duyệt được.
     */
    public <T extends SchoolVoucher> Specification<T> awaitingMe() {
        Optional<RowLevelPrincipal> current = principals.current();
        return (root, query, cb) -> {
            Predicate pending = cb.equal(root.get("status"), VoucherStatus.PENDING);
            if (current.isEmpty()) {
                return cb.disjunction();
            }
            RowLevelPrincipal principal = current.get();
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
     * <p>Bỏ qua bước không có ai để duyệt: trường chưa gán cơ quan quản lý thì
     * không có bước cơ quan quản lý.
     *
     * <p>Chuỗi do Sở cấu hình ({@link ApprovalFlowService#chainOf}) và có thể đổi trong lúc phiếu đang chờ
     * duyệt — bước hiện tại khi đó có thể không còn trong chuỗi. Vì vậy "sau" nghĩa là CẤP cao hơn cấp
     * hiện tại (chuỗi luôn xếp theo thứ tự cấp), không phải "vị trí sau trong danh sách": tìm theo vị trí
     * thì một bước vừa bị bỏ cho {@code indexOf = -1} và phiếu quay về trường duyệt lại từ đầu.
     */
    private ApprovalStep nextStep(SchoolVoucher voucher, ApprovalStep current) {
        List<ApprovalStep> chain = approvalFlows.chainOf(voucher);
        for (ApprovalStep step : chain) {
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

    private void requireTier(SchoolVoucher voucher) {
        if (!inTier(voucher)) {
            throw new FieldValidationException("approvalStep",
                    "Phiếu đang chờ %s duyệt — tài khoản của bạn không thuộc cấp này"
                            .formatted(stepLabel(voucher.getApprovalStep())));
        }
    }

    private static void require(SchoolVoucher voucher, VoucherStatus expected, String action) {
        if (voucher.getStatus() == expected) {
            return;
        }
        throw new FieldValidationException("status",
                "Phiếu đang ở trạng thái \"%s\", không %s được".formatted(statusLabel(voucher.getStatus()), action));
    }

    /**
     * Ghi một sự việc không đổi trạng thái phiếu — vd. trường nhận báo nhận thiếu. Lời
     * nhắn bắt buộc vì chính nó là nội dung: bên kia cần biết thiếu cái gì để bổ sung.
     */
    public void remark(SchoolVoucher voucher, String resource, Action action, String note) {
        String message = trimToNull(note);
        if (message == null) {
            throw new FieldValidationException("note", "Ghi rõ thiếu hoặc sai ở đâu để trường chuyển bổ sung");
        }
        record(voucher, resource, action, voucher.getStatus(), null, message);
    }

    private void record(SchoolVoucher voucher, String resource, Action action, VoucherStatus from,
            ApprovalStep step, String note) {
        Long actorId = CurrentUser.id().orElse(null);
        events.save(new VoucherEvent(resource, voucher.getId(), action, from, voucher.getStatus(), step, note,
                actorId, actorName(actorId)));
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

    static String stepLabel(ApprovalStep step) {
        if (step == null) {
            return "";
        }
        return switch (step) {
            case SCHOOL -> "lãnh đạo trường";
            case MANAGING_BODY -> "cơ quan quản lý của trường";
        };
    }

    static String statusLabel(VoucherStatus status) {
        return switch (status) {
            case DRAFT -> "nháp";
            case PENDING -> "chờ duyệt";
            case APPROVED -> "đã duyệt";
            case COMPLETED -> "hoàn tất";
            case REJECTED -> "bị từ chối";
            case CANCELLED -> "đã huỷ";
        };
    }
}
