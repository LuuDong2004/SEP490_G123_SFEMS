package com.g123.sfems.module.system.approvalflow;

import com.g123.sfems.domain.school.voucher.ApprovalFlowType;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.domain.system.approvalflow.ApprovalFlow;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Luồng phê duyệt của từng loại phiếu: mặc định trong code ({@link ApprovalFlowType}), quản trị viên
 * cấu hình đè lên qua bảng {@code approval_flows}.
 *
 * <p>{@link #chainOf} là câu hỏi DUY NHẤT về "phiếu này phải qua những cấp nào", và
 * {@code VoucherWorkflow} hỏi nó ở mỗi lần trình / duyệt:
 * <ol>
 *   <li>đã cấu hình loại phiếu này → các bước đã cấu hình; phiếu có số tiền từ ngưỡng trở lên thì
 *       theo các bước "từ ngưỡng trở lên";</li>
 *   <li>chưa cấu hình → luồng mặc định.</li>
 * </ol>
 *
 * <p>Bảng chỉ vài dòng và được đọc ở mỗi lần dựng danh sách phiếu, nên giữ trong bộ nhớ: nạp cả
 * bảng, đổi thì nạp lại sau khi commit, và tự nạp lại sau 60 giây.
 */
@Service
@Transactional(readOnly = true)
public class ApprovalFlowService {

    private static final long TTL_MILLIS = 60_000;

    private final ApprovalFlowRepository flows;

    private volatile Map<String, ApprovalFlow> snapshot;
    private volatile long loadedAt;

    public ApprovalFlowService(ApprovalFlowRepository flows) {
        this.flows = flows;
    }

    /** Một loại phiếu trên màn cấu hình: luồng mặc định, luồng đang áp dụng, và những gì đặt được. */
    public record FlowView(
            String resource,
            String label,
            List<ApprovalStep> defaultSteps,
            List<ApprovalStep> steps,
            String amountLabel,
            BigDecimal amountThreshold,
            List<ApprovalStep> stepsAbove,
            boolean customized,
            String note,
            Instant updatedAt) {
    }

    public record FlowRequest(List<ApprovalStep> steps, BigDecimal amountThreshold, List<ApprovalStep> stepsAbove,
            String note) {
    }

    // ------------------------------------------------------------------ dùng bởi vòng duyệt

    /** Các cấp phiếu này phải qua, theo thứ tự — xem javadoc của lớp. */
    public List<ApprovalStep> chainOf(SchoolVoucher voucher) {
        ApprovalFlowType type = ApprovalFlowType.of(voucher).orElse(null);
        if (type == null) {
            // Loại phiếu chưa khai trong ApprovalFlowType: an toàn là bắt lãnh đạo trường duyệt.
            return List.of(ApprovalStep.SCHOOL);
        }
        ApprovalFlow flow = current().get(type.resource());
        if (flow == null) {
            return type.defaultSteps();
        }
        BigDecimal amount = type.amountLabel() == null ? null : voucher.approvalAmount();
        if (flow.getAmountThreshold() != null && amount != null && amount.compareTo(flow.getAmountThreshold()) >= 0) {
            return parse(flow.getStepsAbove());
        }
        return parse(flow.getSteps());
    }

    /**
     * Các cấp đang áp dụng cho MỘT LOẠI phiếu, chưa xét nội dung phiếu nào (ngưỡng tiền). Form lập
     * phiếu dùng nó để biết nút là "Trình" hay "Duyệt" khi phiếu chưa tồn tại. Rỗng {@code Optional}
     * khi loại phiếu không có luồng cấu hình được.
     */
    public Optional<List<ApprovalStep>> stepsOf(String resource) {
        return ApprovalFlowType.of(resource).map(type -> {
            ApprovalFlow flow = current().get(type.resource());
            return flow == null ? type.defaultSteps() : parse(flow.getSteps());
        });
    }

    // ------------------------------------------------------------------ màn cấu hình

    public List<FlowView> list() {
        Map<String, ApprovalFlow> byResource = flows.findAll().stream()
                .collect(Collectors.toMap(ApprovalFlow::getResource, Function.identity()));
        return Arrays.stream(ApprovalFlowType.values()).map(t -> view(t, byResource.get(t.resource()))).toList();
    }

    @Transactional
    public FlowView save(String resource, FlowRequest request) {
        ApprovalFlowType type = typeOf(resource);
        List<ApprovalStep> steps = normalize(request.steps());
        BigDecimal threshold = request.amountThreshold();
        List<ApprovalStep> above = null;
        if (threshold != null) {
            if (type.amountLabel() == null) {
                throw new FieldValidationException("amountThreshold",
                        "%s không có số tiền để đặt ngưỡng".formatted(type.label()));
            }
            if (threshold.signum() <= 0) {
                throw new FieldValidationException("amountThreshold", "Ngưỡng tiền phải lớn hơn 0");
            }
            above = normalize(request.stepsAbove());
            if (above.equals(steps)) {
                throw new FieldValidationException("stepsAbove",
                        "Các bước từ ngưỡng trở lên đang giống hệt các bước thường — bỏ ngưỡng, hoặc chọn bước khác");
            }
        }
        ApprovalFlow flow = flows.findByResource(type.resource()).orElseGet(() -> {
            ApprovalFlow created = new ApprovalFlow();
            created.setResource(type.resource());
            return created;
        });
        flow.setSteps(join(steps));
        flow.setAmountThreshold(threshold);
        flow.setStepsAbove(above == null ? null : join(above));
        flow.setNote(request.note() == null || request.note().isBlank() ? null : request.note().trim());
        ApprovalFlow saved = flows.save(flow);
        reloadAfterCommit();
        return view(type, saved);
    }

    /** Bỏ cấu hình — loại phiếu về luồng mặc định. */
    @Transactional
    public FlowView reset(String resource) {
        ApprovalFlowType type = typeOf(resource);
        flows.findByResource(type.resource()).ifPresent(flows::delete);
        reloadAfterCommit();
        return view(type, null);
    }

    // ------------------------------------------------------------------ nội bộ

    private FlowView view(ApprovalFlowType type, ApprovalFlow flow) {
        return new FlowView(
                type.resource(), type.label(), type.defaultSteps(),
                flow == null ? type.defaultSteps() : parse(flow.getSteps()),
                type.amountLabel(),
                flow == null ? null : flow.getAmountThreshold(),
                flow == null || flow.getStepsAbove() == null ? null : parse(flow.getStepsAbove()),
                flow != null,
                flow == null ? null : flow.getNote(),
                flow == null ? null : (flow.getUpdatedAt() != null ? flow.getUpdatedAt() : flow.getCreatedAt()));
    }

    private static ApprovalFlowType typeOf(String resource) {
        return ApprovalFlowType.of(resource)
                .orElseThrow(() -> new ResourceNotFoundException("Luồng phê duyệt", resource));
    }

    /** Bỏ trùng và xếp theo thứ tự CẤP (trường → cơ quan quản lý). */
    private static List<ApprovalStep> normalize(List<ApprovalStep> steps) {
        return steps == null ? List.of()
                : steps.stream().distinct().sorted(Comparator.comparingInt(Enum::ordinal)).toList();
    }

    private static String join(List<ApprovalStep> steps) {
        return steps.stream().map(Enum::name).collect(Collectors.joining(","));
    }

    /** Mã lạ (sửa tay) bị bỏ qua thay vì làm hỏng cả vòng duyệt. */
    private static List<ApprovalStep> parse(String steps) {
        if (steps == null || steps.isBlank()) {
            return List.of();
        }
        return Arrays.stream(steps.split(","))
                .map(String::trim)
                .flatMap(code -> Arrays.stream(ApprovalStep.values()).filter(s -> s.name().equals(code)))
                .distinct()
                .sorted(Comparator.comparingInt(Enum::ordinal))
                .toList();
    }

    private Map<String, ApprovalFlow> current() {
        Map<String, ApprovalFlow> map = snapshot;
        if (map == null || System.currentTimeMillis() - loadedAt > TTL_MILLIS) {
            synchronized (this) {
                map = snapshot;
                if (map == null || System.currentTimeMillis() - loadedAt > TTL_MILLIS) {
                    map = flows.findAll().stream()
                            .collect(Collectors.toUnmodifiableMap(ApprovalFlow::getResource, Function.identity()));
                    snapshot = map;
                    loadedAt = System.currentTimeMillis();
                }
            }
        }
        return map;
    }

    /** Nạp lại SAU commit: nạp trước thì một yêu cầu khác có thể kịp đọc lại đúng bản sắp bị thay. */
    private void reloadAfterCommit() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            snapshot = null;
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                snapshot = null;
            }
        });
    }
}
