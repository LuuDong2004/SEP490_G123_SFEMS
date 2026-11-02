package com.g123.sfems.module.catalog.schooltype;

import com.g123.sfems.domain.catalog.schooltype.SchoolType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class SchoolTypeService extends CatalogService<SchoolType, SchoolTypeRequest, SchoolTypePatchRequest> {

    public SchoolTypeService(SchoolTypeRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, SchoolType.class, SchoolType::new, "Loại hình trường");
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    /** Ô tìm nhanh dò cả tên viết tắt, để gõ "CL" ra được Công lập. */
    @Override
    protected List<String> searchFields() {
        return List.of("code", "name", "shortName");
    }

    @Override
    protected void applyCreate(SchoolType item, SchoolTypeRequest request) {
        item.setShortName(blankToNull(request.shortName()));
    }

    @Override
    protected void applyUpdate(SchoolType item, SchoolTypePatchRequest request) {
        if (request.shortName() != null) {
            item.setShortName(blankToNull(request.shortName()));
        }
    }
}
