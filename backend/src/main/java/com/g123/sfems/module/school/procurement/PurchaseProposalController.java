package com.g123.sfems.module.school.procurement;

import com.g123.sfems.shared.web.HeavyQuery;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.module.school.voucher.VoucherController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/purchase_proposals} — đề xuất mua sắm; thêm:
 * <ul>
 *   <li>{@code GET /adequacy?schoolId=} — mức đáp ứng định mức của một trường,</li>
 *   <li>{@code GET /adequacy-summary} — tổng hợp mọi trường người xem được thấy (theo cấp học, dải tỷ
 *       lệ, môn, và cân đối thừa - thiếu theo thiết bị); {@code .xlsx} của cả hai,</li>
 *   <li>{@code GET /adequacy-catalog?catalogId=} — một thiết bị, trường nào thiếu, trường nào thừa,</li>
 *   <li>{@code POST /{id}/intake} — hàng về, lập phiếu nhập nháp từ đề xuất.</li>
 * </ul>
 * Hai đường dẫn chữ khai trước {@code /{id}} để thắng biến đường dẫn.
 */
@RestController
@RequestMapping("/api/purchase_proposals")
public class PurchaseProposalController
        extends VoucherController<PurchaseProposal, PurchaseProposalApi.Request, PurchaseProposalApi.Patch> {

    public record IntakeCreated(Long intakeId) {
    }

    private static final MediaType XLSX = MediaType
            .parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final PurchaseProposalService proposals;
    private final AdequacyService adequacy;

    public PurchaseProposalController(PurchaseProposalService service, RowLevelSecurity rowLevel,
            AdequacyService adequacy) {
        super(service, rowLevel);
        this.proposals = service;
        this.adequacy = adequacy;
    }

    @GetMapping("/adequacy")
    public AdequacyService.SchoolAdequacy adequacy(@RequestParam(required = false) Long schoolId) {
        require("read");
        return adequacy.forSchool(resolveSchool(schoolId));
    }

    @GetMapping("/adequacy.xlsx")
    public ResponseEntity<byte[]> adequacyExcel(@RequestParam(required = false) Long schoolId) {
        require("read");
        AdequacyService.SchoolAdequacy a = adequacy.forSchool(resolveSchool(schoolId));
        return xlsx("Thiết bị tối thiểu - " + a.schoolCode() + ".xlsx", AdequacyExcel.school(a));
    }

    @HeavyQuery
    @GetMapping("/adequacy-summary")
    public AdequacyService.Summary adequacySummary() {
        require("read");
        return adequacy.summary();
    }

    @GetMapping("/adequacy-summary.xlsx")
    public ResponseEntity<byte[]> adequacySummaryExcel() {
        require("read");
        return xlsx("Đáp ứng thiết bị tối thiểu.xlsx", AdequacyExcel.summary(adequacy.summary()));
    }

    /** Một thiết bị: trường nào thiếu, trường nào thừa — để cân đối trên địa bàn. */
    @GetMapping("/adequacy-catalog")
    public List<AdequacyService.CatalogSchool> adequacyCatalog(@RequestParam Long catalogId) {
        require("read");
        return adequacy.catalogSchools(catalogId);
    }

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

    private static ResponseEntity<byte[]> xlsx(String filename, byte[] body) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
                .contentType(XLSX)
                .body(body);
    }

    /**
     * Lập phiếu ghi tăng nháp từ đề xuất. Việc này TẠO một phiếu ghi tăng, nên ngoài quyền ghi đề xuất còn
     * phải có quyền ghi phiếu ghi tăng — không thì ai chỉ được lập đề xuất cũng lập được phiếu ghi tăng.
     */
    @PostMapping("/{id}/intake")
    public IntakeCreated createIntake(@PathVariable Long id, @Valid @RequestBody(required = false) IntakeRequest request) {
        require("write");
        if (!CurrentUser.has("equipment_intakes:write")) {
            throw new AccessDeniedException("equipment_intakes:write");
        }
        EquipmentIntake intake = proposals.createIntake(id, request == null ? null : request.lines());
        return new IntakeCreated(intake.getId());
    }

    /** Dòng và số nhập đợt này; vắng {@code lines} là nhập hết phần còn lại. */
    public record IntakeRequest(@Valid List<PurchaseProposalService.IntakePick> lines) {
    }

    /** Các dòng của đề xuất với số đã nhập / còn phải nhập — hộp chọn thiết bị khi lập phiếu ghi tăng. */
    @GetMapping("/{id}/intake-lines")
    public List<PurchaseProposalService.IntakeLine> intakeLines(@PathVariable Long id) {
        require("read");
        return proposals.intakeLines(id);
    }

    @Override
    protected Object toResponse(PurchaseProposal voucher, Map<String, Boolean> can, Set<String> actions) {
        return PurchaseProposalApi.Response.from(voucher, can, actions);
    }
}
