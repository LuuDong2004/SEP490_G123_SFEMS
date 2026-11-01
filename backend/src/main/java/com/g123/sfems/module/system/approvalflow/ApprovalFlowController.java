package com.g123.sfems.module.system.approvalflow;

import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.module.system.approvalflow.ApprovalFlowService.FlowRequest;
import com.g123.sfems.module.system.approvalflow.ApprovalFlowService.FlowView;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/approval_flows} — luồng phê duyệt của từng loại phiếu. Không theo dialect danh sách: số
 * loại phiếu cố định, trả về đủ cả (loại chưa cấu hình mang luồng mặc định, {@code customized = false}).
 *
 * <p>{@code GET /api/approval_flows/{resource}/steps} mở cho mọi tài khoản đăng nhập: form lập phiếu
 * cần biết loại phiếu này có cấp duyệt nào để đặt tên nút "Trình" / "Duyệt".
 */
@RestController
@RequestMapping("/api/approval_flows")
public class ApprovalFlowController {

    private final ApprovalFlowService flows;

    public ApprovalFlowController(ApprovalFlowService flows) {
        this.flows = flows;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('approval_flows:read')")
    public List<FlowView> list() {
        return flows.list();
    }

    @GetMapping("/{resource}/steps")
    public Map<String, List<ApprovalStep>> steps(@PathVariable String resource) {
        return Map.of("steps", flows.stepsOf(resource).orElse(List.of()));
    }

    @PutMapping("/{resource}")
    @PreAuthorize("hasAuthority('approval_flows:write')")
    public FlowView save(@PathVariable String resource, @RequestBody FlowRequest request) {
        return flows.save(resource, request);
    }

    /** Về luồng mặc định của hệ thống. */
    @DeleteMapping("/{resource}")
    @PreAuthorize("hasAuthority('approval_flows:write')")
    public FlowView reset(@PathVariable String resource) {
        return flows.reset(resource);
    }
}
