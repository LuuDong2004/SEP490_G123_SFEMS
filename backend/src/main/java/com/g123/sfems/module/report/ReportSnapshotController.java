package com.g123.sfems.module.report;

import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.office.DownloadNames;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import com.g123.sfems.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lưu trữ báo cáo. {@code POST /api/reports/{name}/snapshots} lưu báo cáo với đúng bộ lọc đang xem;
 * {@code /api/report_snapshots} liệt kê, mở, xuất Excel, xoá bản đã lưu. Cùng quyền {@code reports:read} với xem báo
 * cáo — ai xem được báo cáo thì lưu được; xem bản nào thì theo nơi lập ({@link ReportSnapshotService}).
 */
@RestController
public class ReportSnapshotController {

    private final ReportSnapshotService snapshots;

    public ReportSnapshotController(ReportSnapshotService snapshots) {
        this.snapshots = snapshots;
    }

    public record SaveRequest(@Text(value = FieldRule.NOTE, label = "Ghi chú") String note) {
    }

    @PostMapping("/api/reports/{name}/snapshots")
    @PreAuthorize("hasAuthority('reports:read')")
    public Map<String, Object> save(@PathVariable String name,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Long bodyId,
            @RequestParam(required = false) Long levelId,
            @RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) String group,
            @RequestParam(required = false) String choice,
            @RequestParam(required = false) Long typeId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) Long yearId,
            @RequestParam(required = false) Long campusId,
            @Valid @RequestBody(required = false) SaveRequest body) {
        return snapshots.save(name, new ReportService.Params(from, to, year, bodyId, levelId, schoolId, group, choice,
                typeId, status, condition, campusId, yearId),
                body == null ? null : body.note());
    }

    @GetMapping("/api/report_snapshots")
    @PreAuthorize("hasAuthority('reports:read')")
    public ResponseEntity<List<Map<String, Object>>> list(@RequestParam(required = false) String reportName,
            @RequestParam(required = false) String q, @RequestParam(name = "_start", defaultValue = "0") int start,
            @RequestParam(name = "_end", defaultValue = "20") int end) {
        return ListResponse.of(snapshots.list(reportName, q, start, end), snapshots.count(reportName, q));
    }

    @GetMapping("/api/report_snapshots/{id}")
    @PreAuthorize("hasAuthority('reports:read')")
    public Map<String, Object> get(@PathVariable long id) {
        return snapshots.get(id);
    }

    @DeleteMapping("/api/report_snapshots/{id}")
    @PreAuthorize("hasAuthority('reports:read')")
    public Map<String, Object> delete(@PathVariable long id) {
        return snapshots.delete(id);
    }

    /** Bản lưu ra Excel — đúng số liệu lúc lưu, không tính lại. */
    @GetMapping("/api/report_snapshots/{id}/export")
    @PreAuthorize("hasAuthority('reports:export')")
    @SuppressWarnings("unchecked")
    public ResponseEntity<byte[]> export(@PathVariable long id) {
        Map<String, Object> s = snapshots.get(id);
        List<Map<String, Object>> columns = (List<Map<String, Object>>) s.get("columns");
        byte[] body = XlsxWriter.write(new XlsxWriter.Sheet((String) s.get("title"),
                s.get("subtitle") + " · Bản lưu lúc " + s.get("createdAt"),
                columns.stream().map(c -> new XlsxWriter.Column((String) c.get("key"), (String) c.get("label"),
                        (String) c.get("type"))).toList(),
                (List<Map<String, Object>>) s.get("rows")));
        String file = DownloadNames.safe((String) s.get("title")) + " - bản lưu " + id + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file, StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }
}
