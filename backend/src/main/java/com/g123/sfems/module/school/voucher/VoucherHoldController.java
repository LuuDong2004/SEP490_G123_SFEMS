package com.g123.sfems.module.school.voucher;

import java.util.Arrays;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/voucher_holds?equipmentIds=1,2} — tài sản nào đang bị một phiếu đang chạy giữ
 * ({@link VoucherHolds}). Ô chọn tài sản của form phiếu dùng nó để khoá sẵn dòng đó, thay vì để người lập tới bước
 * trình mới biết. Đọc được tài sản là đủ: chỉ trả tài sản thuộc trường người gọi thấy.
 *
 * <p>{@code GET /api/voucher_holds/drafts?resource=damage_reports&equipmentIds=1,2&exceptId=5} — tài sản nào đã nằm
 * trên một phiếu NHÁP khác cùng loại, để form nhắc người lập là đang lập trùng.
 */
@RestController
@RequestMapping("/api/voucher_holds")
public class VoucherHoldController {

    private final VoucherHolds holds;

    public VoucherHoldController(VoucherHolds holds) {
        this.holds = holds;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('equipment:read')")
    public List<VoucherHolds.Hold> list(@RequestParam(defaultValue = "") String equipmentIds) {
        return holds.heldBy(ids(equipmentIds));
    }

    @GetMapping("/drafts")
    @PreAuthorize("hasAuthority('equipment:read')")
    public List<VoucherHolds.Draft> drafts(@RequestParam String resource, @RequestParam(defaultValue = "") String equipmentIds,
            @RequestParam(required = false) Long exceptId) {
        return holds.draftsWith(resource, exceptId, ids(equipmentIds));
    }

    private static List<Long> ids(String csv) {
        return Arrays.stream(csv.split(","))
                .map(String::trim).filter(v -> v.matches("\\d{1,18}")).limit(200).map(Long::valueOf).toList();
    }
}
