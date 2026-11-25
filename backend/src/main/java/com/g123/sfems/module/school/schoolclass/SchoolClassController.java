package com.g123.sfems.module.school.schoolclass;

import com.g123.sfems.domain.school.schoolclass.SchoolClass;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/school_classes} — mã quyền {@code school_classes:*}. */
@RestController
@RequestMapping("/api/school_classes")
public class SchoolClassController
        extends CatalogController<SchoolClass, SchoolClassRequest, SchoolClassPatchRequest> {

    private final SchoolClassService service;
    private final RowLevelSecurity rowLevel;

    public SchoolClassController(SchoolClassService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
        this.service = service;
        this.rowLevel = rowLevel;
    }

    @Override
    protected String resource() {
        return "school_classes";
    }

    @Override
    protected Object respond(SchoolClass item, RowLevelSecurity rowLevel) {
        return SchoolClassResponse.from(item, rowLevel);
    }

    /** "Thêm nhanh": N lớp một khối (6A1…6A4). Trả về các lớp vừa thêm; lớp đã có thì bỏ qua. */
    @PostMapping("/bulk")
    @PreAuthorize("hasAuthority('school_classes:write')")
    public List<Object> createMany(@Valid @RequestBody SchoolClassBulkRequest request) {
        return service.createMany(request).stream().map(c -> respond(c, rowLevel)).toList();
    }
}
