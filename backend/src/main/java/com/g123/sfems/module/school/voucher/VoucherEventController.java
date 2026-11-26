package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.data.RecordAccessRegistry;
import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/voucher_events?resource=&voucherId=} — dòng thời gian duyệt của
 * một phiếu.
 *
 * <p>Không có mã quyền riêng: ai đọc được phiếu thì đọc được nhật ký duyệt của
 * nó. Cả mã quyền đọc lẫn phạm vi dữ liệu của phiếu được hỏi qua
 * {@link RecordAccessRegistry}.
 */
@RestController
@RequestMapping("/api/voucher_events")
public class VoucherEventController {

    public record VoucherEventResponse(
            Long id,
            VoucherEvent.Action action,
            VoucherStatus fromStatus,
            VoucherStatus toStatus,
            ApprovalStep step,
            String note,
            Long actorId,
            String actorName,
            Instant createdAt) {

        static VoucherEventResponse from(VoucherEvent event) {
            return new VoucherEventResponse(event.getId(), event.getAction(), event.getFromStatus(),
                    event.getToStatus(), event.getStep(), event.getNote(), event.getActorId(),
                    event.getActorName(), event.getCreatedAt());
        }
    }

    private final VoucherWorkflow workflow;
    private final RecordAccessRegistry records;
    private final VoucherApprovers approvers;

    public VoucherEventController(VoucherWorkflow workflow, RecordAccessRegistry records, VoucherApprovers approvers) {
        this.workflow = workflow;
        this.records = records;
        this.approvers = approvers;
    }

    @GetMapping
    public List<VoucherEventResponse> list(@RequestParam String resource, @RequestParam Long voucherId) {
        records.checkReadable(resource, voucherId);
        return workflow.history(resource, voucherId).stream().map(VoucherEventResponse::from).toList();
    }

    /**
     * {@code GET /api/voucher_events/approvers?resource=&voucherId=} — người duyệt của phiếu lúc này: đang chờ thì những
     * người duyệt được bước đó, đã quyết thì những người đã duyệt / từ chối ở lần trình gần nhất. Cùng quyền đọc với
     * dòng thời gian.
     */
    @GetMapping("/approvers")
    public VoucherApprovers.Current approvers(@RequestParam String resource, @RequestParam Long voucherId) {
        records.checkReadable(resource, voucherId);
        return approvers.current(resource, voucherId);
    }
}
