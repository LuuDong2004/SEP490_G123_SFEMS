package com.g123.sfems.module.system.dataimport;

import java.io.IOException;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Nhập thiết bị từ tệp theo mẫu (TS-07). Đường dẫn theo tên resource {@code data_imports}. */
@RestController
@RequestMapping("/api/data_imports/equipment")
public class EquipmentImportController {

    private final EquipmentImportService imports;

    public EquipmentImportController(EquipmentImportService imports) {
        this.imports = imports;
    }

    /** Kiểm tra tệp và trả lỗi theo từng dòng. Không ghi gì. */
    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('data_imports:write')")
    public EquipmentImportService.Preview preview(@RequestParam("file") MultipartFile file) throws IOException {
        return imports.preview(file.getOriginalFilename(), file.getBytes());
    }

    /** Ghi tệp. Chỉ ghi khi tệp không có lỗi nào. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('data_imports:write')")
    public Map<String, Object> commit(@RequestParam("file") MultipartFile file) throws IOException {
        int created = imports.commit(file.getOriginalFilename(), file.getBytes());
        return Map.of("created", created);
    }
}
