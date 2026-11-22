package com.g123.sfems.module.catalog.educationlevel.api;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.module.catalog.educationlevel.api.dto.EducationLevelPatchRequest;
import com.g123.sfems.module.catalog.educationlevel.api.dto.EducationLevelRequest;
import com.g123.sfems.module.catalog.educationlevel.api.dto.EducationLevelResponse;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.Permissions;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/education_levels} — resource {@code education_levels} của màn
 * quản trị.
 *
 * <p>Đoạn đường dẫn phải trùng đúng tên resource khai trong {@code routes.tsx}
 * của frontend, vì data provider dựng mọi endpoint thành
 * {@code {apiURL}/{resource}} — và cũng chính tên đó là nửa đầu của các mã
 * quyền kiểm ở dưới.
 */
@RestController
@RequestMapping("/api/education_levels")
public class EducationLevelController {

    private final EducationLevelService service;

    private final RowLevelSecurity rowLevel;

    public EducationLevelController(EducationLevelService service, RowLevelSecurity rowLevel) {
        this.service = service;
        this.rowLevel = rowLevel;
    }

    /**
     * Phục vụ cả {@code getList} lẫn {@code getMany}.
     *
     * <p>Hai cái chỉ khác nhau ở query string — {@code getMany} gửi
     * {@code ids[n]} và không có cửa sổ phân trang — nên dùng chung một
     * endpoint, nhánh tra id trả về không phân trang.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.EDUCATION_LEVELS_READ + "')")
    public ResponseEntity<List<EducationLevelResponse>> list(
            @RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<EducationLevelResponse> rows = service.getMany(ids).stream()
                    .map(row -> EducationLevelResponse.from(row, rowLevel))
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<EducationLevel> page = service.list(params);
        return ListResponse.of(
                page.map(row -> EducationLevelResponse.from(row, rowLevel)).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.EDUCATION_LEVELS_READ + "')")
    public EducationLevelResponse get(@PathVariable Long id) {
        return EducationLevelResponse.from(service.get(id), rowLevel);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + Permissions.EDUCATION_LEVELS_WRITE + "')")
    public ResponseEntity<EducationLevelResponse> create(
            @Valid @RequestBody EducationLevelRequest request) {
        EducationLevel created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/education_levels/" + created.getId()))
                .body(EducationLevelResponse.from(created, rowLevel));
    }

    /**
     * {@code PATCH} là thứ data provider gửi mặc định; {@code PUT} ánh xạ vào
     * cùng handler để resource này cũng dùng được từ client chỉ nói được thay
     * thế toàn phần.
     */
    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + Permissions.EDUCATION_LEVELS_WRITE + "')")
    public EducationLevelResponse update(
            @PathVariable Long id, @Valid @RequestBody EducationLevelPatchRequest request) {
        return EducationLevelResponse.from(service.update(id, request), rowLevel);
    }

    /** Vọng lại bản ghi vừa xoá — data provider có phân tích body trả về. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.EDUCATION_LEVELS_DELETE + "')")
    public EducationLevelResponse delete(@PathVariable Long id) {
        return EducationLevelResponse.from(service.delete(id));
    }
}
