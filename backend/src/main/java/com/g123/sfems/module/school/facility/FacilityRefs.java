package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.module.catalog.base.dto.RefSummary;

/** Rút gọn tham chiếu cho các DTO cơ sở vật chất. */
final class FacilityRefs {

    private FacilityRefs() {
    }

    static RefSummary school(SchoolOwnedEntity item) {
        School school = item.getSchool();
        return new RefSummary(school.getId(), school.getCode(), school.getName());
    }
}
