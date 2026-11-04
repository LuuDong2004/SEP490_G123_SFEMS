package com.g123.sfems.module.organization.school.api;

import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.shared.security.Permissions;
import java.util.List;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> row = rows.getFirst();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType((String) row.get("content_type")))
                .cacheControl(CacheControl.noCache())
                .body((byte[]) row.get("data"));
    }
}
