package com.g123.sfems.module.school.staff;

import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.module.system.datachange.DataChangeResponse;
import com.g123.sfems.module.system.datachange.DataChangeService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/staff} — mã quyền {@code staff:*}, phạm vi dòng theo trường. */
@RestController
@RequestMapping("/api/staff")
public class StaffController extends CatalogController<Staff, StaffRequest, StaffPatchRequest> {

    private final StaffService staff;
    private final DataChangeService changes;

    public StaffController(StaffService service, RowLevelSecurity rowLevel, DataChangeService changes) {
        super(service, rowLevel);
        this.staff = service;
        this.changes = changes;
    }

    /**
     * Lịch sử sửa hồ sơ một cán bộ (ai, lúc nào, ô nào, cũ → mới), mới nhất trước. Cùng quyền với xem hồ sơ: mã
     * {@code staff:read} + cán bộ nằm trong phạm vi đọc (ngoài phạm vi là 404 như xem chi tiết).
     */
    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority('staff:read')")
    public List<DataChangeResponse> history(@PathVariable Long id) {
        staff.get(id);
        return changes.ofRecord("staff", id);
    }

    @Override
    protected String resource() {
        return "staff";
    }

    @Override
    protected Object respond(Staff item, RowLevelSecurity rowLevel) {
        return StaffResponse.from(item, rowLevel);
    }
}
