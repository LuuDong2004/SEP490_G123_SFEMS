package com.g123.sfems.module.school.voucher;

import com.g123.sfems.module.system.approvalflow.ApprovalFlowService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/voucher_forms/{resource}} — cấu hình các mục và trường chứng từ
 * của một loại phiếu, cho màn hình vẽ form, màn chi tiết và bản in. Chỉ là hình
 * dạng, không có dữ liệu nào, nên người đăng nhập nào cũng đọc được.
 *
 * <p>Kèm {@code approvalSteps}: các cấp duyệt đang áp dụng cho loại phiếu (Sở cấu hình ở "Luồng phê
 * duyệt"). Form lập phiếu đọc nó để gọi đúng tên nút thứ hai — danh sách rỗng là phiếu bấm là xong,
 * không ai duyệt, nên nút là "Duyệt" chứ không phải "Trình".
 */
@RestController
public class VoucherFormController {

    private final VoucherForms forms;
    private final ApprovalFlowService approvalFlows;

    public VoucherFormController(VoucherForms forms, ApprovalFlowService approvalFlows) {
        this.forms = forms;
        this.approvalFlows = approvalFlows;
    }

    @GetMapping("/api/voucher_forms/{resource}")
    public Map<String, Object> form(@PathVariable String resource) {
        Map<String, Object> form = new LinkedHashMap<>(forms.form(resource));
        approvalFlows.stepsOf(resource).ifPresent(steps -> form.put("approvalSteps", steps));
        return form;
    }
}
