package com.g123.sfems.module.catalog.educationlevel.api;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.module.catalog.educationlevel.api.dto.EducationLevelPatchRequest;
import com.g123.sfems.module.catalog.educationlevel.api.dto.EducationLevelRequest;
import com.g123.sfems.module.catalog.educationlevel.api.dto.EducationLevelResponse;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
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
 * Năm endpoint của danh mục cấp học (DM-01). Cấp học có service viết riêng (không qua
 * {@code CatalogService}) nên controller cũng viết tay, nhưng giữ đúng hợp đồng của mọi danh mục:
 * danh sách là mảng JSON kèm header {@code X-Total-Count}, mã quyền {@code education_levels:*}.
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

    /** Phục vụ cả {@code getList} lẫn {@code getMany} — chỉ khác ở query string. */
    @GetMapping
    @PreAuthorize("hasAuthority('education_levels:read')")
    public ResponseEntity<List<EducationLevelResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<EducationLevelResponse> rows = service.getMany(ids).stream()
                    .map(level -> EducationLevelResponse.from(level, rowLevel))
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<EducationLevel> page = service.list(params);
        return ListResponse.of(
                page.map(level -> EducationLevelResponse.from(level, rowLevel)).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('education_levels:read')")
    public EducationLevelResponse get(@PathVariable Long id) {
        return EducationLevelResponse.from(service.get(id), rowLevel);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('education_levels:write')")
    public ResponseEntity<EducationLevelResponse> create(@Valid @RequestBody EducationLevelRequest request) {
        EducationLevel created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/education_levels/" + created.getId()))
                .body(EducationLevelResponse.from(created, rowLevel));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('education_levels:write')")
    public EducationLevelResponse update(@PathVariable Long id, @Valid @RequestBody EducationLevelPatchRequest request) {
        return EducationLevelResponse.from(service.update(id, request), rowLevel);
    }

    /** Vọng lại bản ghi vừa xoá — data provider có phân tích body trả về. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('education_levels:delete')")
    public EducationLevelResponse delete(@PathVariable Long id) {
        return EducationLevelResponse.from(service.delete(id));
    }
}
