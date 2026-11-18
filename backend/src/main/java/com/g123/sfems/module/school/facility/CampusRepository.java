package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Campus;
import com.g123.sfems.module.school.base.SchoolOwnedRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CampusRepository extends SchoolOwnedRepository<Campus> {

    /**
     * Bỏ cờ cơ sở chính của mọi cơ sở khác CÙNG trường. Lệnh ghi không phạm vi,
     * khai tường minh để review thấy: bất biến "một cơ sở chính mỗi trường" là
     * của cả trường, không phải của phạm vi người gọi.
     */
    @Modifying
    @Query("update Campus c set c.primaryCampus = false"
            + " where c.school.id = :schoolId and c.primaryCampus = true and c.id <> :keepId")
    int clearPrimaryExcept(@Param("schoolId") Long schoolId, @Param("keepId") Long keepId);
}
