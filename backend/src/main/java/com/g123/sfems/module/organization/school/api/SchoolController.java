package com.g123.sfems.module.organization.school.api;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.module.organization.school.api.dto.SchoolPatchRequest;
import com.g123.sfems.module.organization.school.api.dto.SchoolRequest;
import com.g123.sfems.module.organization.school.api.dto.SchoolResponse;
import com.g123.sfems.module.organization.school.service.SchoolService;
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

/** {@code /api/schools} — resource {@code schools} của màn quản trị. */
@RestController
@RequestMapping("/api/schools")
public class SchoolController {

    private final SchoolService service;
    private final RowLevelSecurity rowLevel;

    public SchoolController(SchoolService service, RowLevelSecurity rowLevel) {
        this.service = service;
        this.rowLevel = rowLevel;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_READ + "')")
    public ResponseEntity<List<SchoolResponse>> list(
            @RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<SchoolResponse> rows = service.getMany(ids).stream()
                    .map(row -> SchoolResponse.from(row, rowLevel))
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<School> page = service.list(params);
        return ListResponse.of(
                page.map(row -> SchoolResponse.from(row, rowLevel)).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_READ + "')")
    public SchoolResponse get(@PathVariable Long id) {
        return SchoolResponse.from(service.get(id), rowLevel);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_WRITE + "')")
    public ResponseEntity<SchoolResponse> create(@Valid @RequestBody SchoolRequest request) {
        School created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/schools/" + created.getId()))
                .body(SchoolResponse.from(created, rowLevel));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_WRITE + "')")
    public SchoolResponse update(
            @PathVariable Long id, @Valid @RequestBody SchoolPatchRequest request) {
        return SchoolResponse.from(service.update(id, request), rowLevel);
    }

    /** Vọng lại bản ghi vừa xoá — data provider có phân tích body trả về. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_DELETE + "')")
    public SchoolResponse delete(@PathVariable Long id) {
        return SchoolResponse.from(service.delete(id));
    }
}
