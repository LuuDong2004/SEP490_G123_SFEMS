package com.g123.sfems.module.organization.school.api;

import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.Permissions;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Logo của trường, lưu thẳng trong database ({@code school_logos}).
 *
 * <p>Hệ thống chưa có kho lưu tệp, và logo là ảnh nhỏ (frontend thu về tối đa
 * 256px trước khi gửi) nên bảng riêng là đủ. Tách khỏi {@code schools} để danh
 * sách trường không kéo theo ảnh.
 *
 * <p>Chỉ nhận PNG / JPEG / WebP — không SVG: SVG là tài liệu có thể chứa script.
 * Phạm vi: xem theo quyền đọc trường, đặt/xoá theo quyền SỬA trường đó.
 */
@RestController
@RequestMapping("/api/schools/{id}/logo")
public class SchoolLogoController {

    private static final Pattern DATA_URL =
            Pattern.compile("^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$");
    private static final int MAX_BYTES = 300 * 1024;

    private final SchoolService schools;
    private final JdbcTemplate jdbc;

    public SchoolLogoController(SchoolService schools, JdbcTemplate jdbc) {
        this.schools = schools;
        this.jdbc = jdbc;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_READ + "')")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> get(@PathVariable Long id) {
        schools.get(id);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT content_type, data FROM school_logos WHERE school_id = ?", id);
        if (rows.isEmpty()) {
            // Chưa có logo là chuyện thường, không phải lỗi: 204 thay vì 404, khỏi một dòng lỗi đỏ trên console mỗi
            // lần mở màn trường (E2E-29). Giao diện coi 204 là "chưa có logo".
            return ResponseEntity.noContent().build();
        }
        Map<String, Object> row = rows.getFirst();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType((String) row.get("content_type")))
                .cacheControl(CacheControl.noCache())
                .body((byte[]) row.get("data"));
    }

    public record LogoRequest(String dataUrl) {
    }

    @PutMapping
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_WRITE + "')")
    @Transactional
    public ResponseEntity<Void> put(@PathVariable Long id, @RequestBody LogoRequest request) {
        schools.getWritable(id);
        Matcher m = DATA_URL.matcher(request.dataUrl() == null ? "" : request.dataUrl().trim());
        if (!m.matches()) {
            throw new FieldValidationException("logo", "Logo phải là ảnh PNG, JPEG hoặc WebP");
        }
        byte[] data;
        try {
            data = Base64.getDecoder().decode(m.group(2));
        } catch (IllegalArgumentException e) {
            throw new FieldValidationException("logo", "Ảnh logo không đọc được");
        }
        if (data.length > MAX_BYTES) {
            throw new FieldValidationException("logo", "Logo tối đa 300 KB");
        }
        jdbc.update(
                "INSERT INTO school_logos (school_id, content_type, data, updated_at) VALUES (?, ?, ?, now())"
                        + " ON CONFLICT (school_id) DO UPDATE"
                        + " SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, updated_at = now()",
                id, m.group(1), data);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_WRITE + "')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        schools.getWritable(id);
        jdbc.update("DELETE FROM school_logos WHERE school_id = ?", id);
        return ResponseEntity.noContent().build();
    }
}
