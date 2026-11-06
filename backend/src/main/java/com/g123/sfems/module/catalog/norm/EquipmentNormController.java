package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/equipment_norms")
public class EquipmentNormController extends CatalogController<
        EquipmentNorm, EquipmentNormRequest, EquipmentNormPatchRequest> {
    private final EquipmentNormService norms;
    private final EquipmentNormExcel excel;

    public EquipmentNormController(EquipmentNormService service, RowLevelSecurity rowLevel, EquipmentNormExcel excel) {
        super(service, rowLevel);
        this.norms = service;
        this.excel = excel;
    }
    @Override protected String resource() { return "equipment_norms"; }
    @Override protected Object respond(EquipmentNorm item, RowLevelSecurity rowLevel) {
        return EquipmentNormResponse.from(item, rowLevel);
    }

    @GetMapping("/groups")
    @PreAuthorize("hasAuthority('equipment_norms:read')")
    public List<EquipmentNormService.SubjectGroup> groups(@RequestParam MultiValueMap<String, String> query) {
        return norms.groups(new ListParams(query));
    }

    @GetMapping("/topics")
    @PreAuthorize("hasAuthority('equipment_norms:read')")
    public List<EquipmentNormService.TopicOption> topics(@RequestParam("standard.id") Long standardId) {
        return norms.topics(standardId);
    }

    @GetMapping("/export.xlsx")
    @PreAuthorize("hasAuthority('equipment_norms:read')")
    public ResponseEntity<byte[]> export(@RequestParam MultiValueMap<String, String> query,
            @RequestParam("standard.id") Long standardId) {
        EquipmentNormExcel.Export file = excel.export(new ListParams(query), standardId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.filename(), StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(file.body());
    }

    @PostMapping("/import")
    @PreAuthorize("hasAuthority('equipment_norms:write')")
    public Map<String, Integer> importFile(@RequestParam("file") MultipartFile file,
            @RequestParam("standardId") Long standardId) {
        if (file.isEmpty()) throw new FieldValidationException("file", "Chọn tệp để nhập");
        if (file.getSize() > 10L * 1024 * 1024) throw new FieldValidationException("file", "Tệp lớn hơn 10 MB");
        try {
            return Map.of("created", excel.importFile(standardId, file.getOriginalFilename(), file.getBytes()));
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp tải lên");
        }
    }
}
