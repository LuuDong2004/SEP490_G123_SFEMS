package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.module.school.voucher.VoucherController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/purchase_proposals} — đề xuất mua sắm (NC-02..NC-07). Năm endpoint CRUD và các bước duyệt
 * ({@code submit|approve|return|reject|cancel}) lấy từ {@link VoucherController}; ở đây thêm:
 *
 * <ul>
 *   <li>{@code GET /adequacy?schoolId=} — mức đáp ứng định mức của một trường (NC-01),</li>
 *   <li>{@code GET /adequacy-summary} — tổng hợp mọi trường người xem được thấy,</li>
 *   <li>{@code GET /overlaps} — thiết bị đang được xin ở các đề xuất còn hiệu lực khác của trường,</li>
 *   <li>{@code GET /{id}/intake-lines} và {@code POST /{id}/intake} — hàng về, lập phiếu nhập nháp từ đề
 *       xuất (NC-07, xem ghi chú ở {@link PurchaseProposalService}).</li>
 * </ul>
 *
 * <p>Hai đường dẫn chữ ({@code adequacy}, {@code adequacy-summary}, {@code overlaps}) khai trước
 * {@code /{id}} để thắng biến đường dẫn.
 *
 * <p>Bản gốc gắn {@code @HeavyQuery} cho {@code adequacy-summary} và có thêm ba đường Excel. Repo nhóm
 * chưa có {@code HeavyQuery} lẫn {@code shared/office/XlsxWriter} (đều là {@code shared/**}), nên ở đây
 * bỏ hai thứ đó; phần xuất Excel làm sau khi nhóm có bộ ghi tệp dùng chung.
 */
@RestController
@RequestMapping("/api/purchase_proposals")
public class PurchaseProposalController
        extends VoucherController<PurchaseProposal, PurchaseProposalApi.Request, PurchaseProposalApi.Patch> {

    private final PurchaseProposalService proposals;
    private final AdequacyService adequacy;

    public PurchaseProposalController(PurchaseProposalService service, RowLevelSecurity rowLevel,
            AdequacyService adequacy) {
        super(service, rowLevel);
        this.proposals = service;
        this.adequacy = adequacy;
    }

    // ------------------------------------------------------------------ NC-01: mức đáp ứng định mức

    @GetMapping("/adequacy")
    @PreAuthorize("hasAuthority('purchase_proposals:read')")
    public AdequacyService.SchoolAdequacy adequacy(@RequestParam(required = false) Long schoolId) {
        return adequacy.forSchool(resolveSchool(schoolId));
    }

    @GetMapping("/adequacy-summary")
    @PreAuthorize("hasAuthority('purchase_proposals:read')")
    public AdequacyService.Summary adequacySummary() {
        return adequacy.summary();
    }

    // ------------------------------------------------------------------ NC-02..04: đề xuất

    /**
     * Thiết bị đang được xin ở các đề xuất còn hiệu lực KHÁC của trường (bỏ {@code excludeId} — phiếu đang
     * xem / đang sửa): form lập đề xuất và màn duyệt cảnh báo xin trùng.
     */
    @GetMapping("/overlaps")
    public List<PurchaseProposalService.Overlap> overlaps(@RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) Long excludeId) {
        require("read");
        return proposals.overlaps(resolveSchool(schoolId), excludeId);
    }

    /** Không nêu trường: tài khoản chỉ thấy đúng một trường thì là trường đó. */
    private Long resolveSchool(Long schoolId) {
        if (schoolId != null) {
            return schoolId;
        }
        Set<Long> visible = adequacy.visibleSchools();
        if (visible == null || visible.size() != 1) {
            throw new FieldValidationException("schoolId", "Chọn trường");
        }
        return visible.iterator().next();
    }

    // ------------------------------------------------------------------ DTO

    /** Chi tiết kèm mảng dòng; danh sách chỉ kèm các con số tổng. */
    @Override
    protected Object toResponse(PurchaseProposal voucher, Map<String, Boolean> can, Set<String> actions) {
        return PurchaseProposalApi.Response.from(voucher, can, actions);
    }

    @Override
    protected Object toListResponse(PurchaseProposal voucher, Map<String, Boolean> can, Set<String> actions) {
        return PurchaseProposalApi.Response.summary(voucher, can, actions);
    }
}
