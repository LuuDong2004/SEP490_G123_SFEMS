package com.g123.sfems.module.catalog.facilitygroup;

import com.g123.sfems.domain.catalog.facilitygroup.FacilityGroup;
import com.g123.sfems.domain.catalog.facilitygroup.FacilityLevels;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Khối CSVC. Phần chung ở {@link CatalogService}; lớp này gán cấp áp dụng. Loại CSVC phân giải một khối qua
 * {@code get(id)} của lớp này. Mã khối theo danh mục của Sở (03…09), gõ tay — không có quy tắc sinh mã.
 */
@Service
public class FacilityGroupService extends CatalogService<FacilityGroup, FacilityGroupRequest, FacilityGroupPatchRequest> {

    @Override
    protected boolean codeLocked() {
        return true;
    }

    public FacilityGroupService(FacilityGroupRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, FacilityGroup.class, FacilityGroup::new, "Khối CSVC");
    }

    @Override
    protected String codeTarget() {
        return null;
    }

    @Override
    protected void applyCreate(FacilityGroup item, FacilityGroupRequest request) {
        item.setLevels(levels(request.levels()));
    }

    @Override
    protected void applyUpdate(FacilityGroup item, FacilityGroupPatchRequest request) {
        if (request.levels() != null) {
            item.setLevels(levels(request.levels()));
        }
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    /** Danh sách mã cấp → chuỗi lưu; mã lạ thành lỗi của ô {@code levels}. Loại CSVC dùng lại. */
    public static String levels(List<String> codes) {
        try {
            return FacilityLevels.join(codes);
        } catch (IllegalArgumentException e) {
            throw new FieldValidationException("levels", "Cấp học không hợp lệ: " + e.getMessage());
        }
    }
}
