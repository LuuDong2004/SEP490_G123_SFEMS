package com.g123.sfems.module.organization.departmentofeducation.api;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.module.organization.departmentofeducation.api.dto.DepartmentOfEducationResponse;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.Permissions;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/departments_of_education} — resource
 * {@code departments_of_education} của màn quản trị.
 *
 * <p>Đoạn đường dẫn phải trùng đúng tên resource khai trong
 * {@code routes.tsx}, vì data provider dựng mọi endpoint thành
 * {@code apiURL + "/" + resource} — và cũng chính tên đó là nửa đầu của các mã
 * quyền kiểm ở dưới.
 */
@RestController
@RequestMapping("/api/departments_of_education")
public class DepartmentOfEducationController {

    private final DepartmentOfEducationService service;

    // Chỉ để đóng dấu người gọi được làm gì với từng dòng. Việc lọc đã xảy ra
    // rồi, bên trong service, như một phần của truy vấn.
    private final RowLevelSecurity rowLevel;

    public DepartmentOfEducationController(
            DepartmentOfEducationService service, RowLevelSecurity rowLevel) {
        this.service = service;
        this.rowLevel = rowLevel;
    }

    /**
     * Phục vụ cả {@code getList} lẫn {@code getMany} — hai cái chỉ khác nhau ở
     * query string, nên dùng chung một endpoint và nhánh tra id trả về không
     * phân trang.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.DEPARTMENTS_OF_EDUCATION_READ + "')")
    public ResponseEntity<List<DepartmentOfEducationResponse>> list(
            @RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<DepartmentOfEducationResponse> rows = service.getMany(ids).stream()
                    .map(row -> DepartmentOfEducationResponse.from(row, rowLevel))
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<DepartmentOfEducation> page = service.list(params);
        return ListResponse.of(
                page.map(row -> DepartmentOfEducationResponse.from(row, rowLevel)).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.DEPARTMENTS_OF_EDUCATION_READ + "')")
    public DepartmentOfEducationResponse get(@PathVariable Long id) {
        return DepartmentOfEducationResponse.from(service.get(id), rowLevel);
    }
}
