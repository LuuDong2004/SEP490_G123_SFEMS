package com.g123.sfems.module.school.facilitystandard;

import com.g123.sfems.shared.office.DownloadNames;
import java.nio.charset.StandardCharsets;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/facility-standard} — đánh giá mức độ chuẩn CSVC của một trường.
 *
 * <ul>
 *   <li>{@code GET /schools/{id}} — kết quả theo khối, loại, ba mức;</li>
 *   <li>{@code GET /schools/{id}/export} — tệp Excel theo mẫu "Đánh giá mức độ chuẩn" của Sở.</li>
 * </ul>
 * Ai xem được phòng (cán bộ trường) hoặc báo cáo (UBND, Sở) đều xem được; trường ngoài phạm vi là 404. Bảng tổng hợp
 * nhiều trường là báo cáo {@code facility-standard} của {@code /api/reports}.
 */
@RestController
@RequestMapping("/api/facility-standard")
public class FacilityStandardController {

    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final FacilityStandardService standards;

    public FacilityStandardController(FacilityStandardService standards) {
        this.standards = standards;
    }

    @GetMapping("/schools/{schoolId}")
    @PreAuthorize("hasAnyAuthority('rooms:read', 'reports:read')")
    public FacilityStandardService.Evaluation evaluate(@PathVariable Long schoolId,
            @RequestParam(required = false) Long campusId) {
        return standards.evaluate(schoolId, campusId);
    }

    @GetMapping("/schools/{schoolId}/export")
    @PreAuthorize("hasAnyAuthority('rooms:read', 'reports:read')")
    public ResponseEntity<byte[]> export(@PathVariable Long schoolId,
            @RequestParam(required = false) Long campusId) {
        FacilityStandardService.Evaluation evaluation = standards.evaluate(schoolId, campusId);
        byte[] body = FacilityStandardExcel.write(evaluation);
        String file = "Danh gia muc do chuan - " + DownloadNames.safe(evaluation.school().name()) + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file, StandardCharsets.UTF_8).build().toString())
                .contentType(XLSX)
                .body(body);
    }
}
