package com.g123.sfems.module.school.procurement;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.Set;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Mức đáp ứng định mức thiết bị tối thiểu theo trường (NC-01) — hai đường đọc của màn Chuẩn tối thiểu:
 *
 * <ul>
 *   <li>{@code GET /api/purchase_proposals/adequacy?schoolId=} — từng định mức của một trường: đòi bao
 *       nhiêu, đang có bao nhiêu, thiếu bao nhiêu;</li>
 *   <li>{@code GET /api/purchase_proposals/adequacy-summary} — một dòng cho mỗi trường người xem được thấy.</li>
 * </ul>
 *
 * <p>Đường dẫn nằm dưới {@code purchase_proposals} như ở bản gốc: mức đáp ứng là lý do lập đề xuất mua
 * sắm. Quyền đọc là {@code purchase_proposals:read} — mã quyền đã seed ở changelog 006 và mô tả của nó nói
 * đúng việc này ("Xem đề xuất mua sắm và mức đáp ứng định mức").
 *
 * <p>Tài khoản trường không cần truyền {@code schoolId}: nhìn thấy đúng một trường thì lấy trường đó.
 * Sở và UBND thấy nhiều trường nên phải chọn — đoán thay sẽ trả số liệu của một trường khác mà không
 * một lỗi nào hiện ra.
 *
 * <p>Bản gốc đặt hai đường này trong {@code PurchaseProposalController}. Ở đây chúng tách riêng vì khung
 * phiếu của nhóm chưa có bộ đề xuất mua sắm; khi có, hai mapping này phải dọn về đó để khỏi trùng đường.
 */
@RestController
@RequestMapping("/api/purchase_proposals")
public class AdequacyController {

    private final AdequacyService adequacy;

    public AdequacyController(AdequacyService adequacy) {
        this.adequacy = adequacy;
    }

    @GetMapping("/adequacy")
    @PreAuthorize("hasAuthority('purchase_proposals:read')")
    public AdequacyService.SchoolAdequacy adequacy(@RequestParam(required = false) Long schoolId) {
        Long id = schoolId;
        if (id == null) {
            Set<Long> visible = adequacy.visibleSchools();
            if (visible == null || visible.size() != 1) {
                throw new FieldValidationException("schoolId", "Chọn trường");
            }
            id = visible.iterator().next();
        }
        return adequacy.forSchool(id);
    }

    @GetMapping("/adequacy-summary")
    @PreAuthorize("hasAuthority('purchase_proposals:read')")
    public AdequacyService.Summary adequacySummary() {
        return adequacy.summary();
    }
}
