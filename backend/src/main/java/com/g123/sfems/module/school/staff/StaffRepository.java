package com.g123.sfems.module.school.staff;

import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.module.school.base.SchoolOwnedRepository;
import java.util.List;

public interface StaffRepository extends SchoolOwnedRepository<Staff> {

    /** Người khác cùng trường đang giữ chức vụ này — {@code selfId} = -1 khi đang tạo mới. */
    boolean existsBySchoolIdAndPositionAndIdNot(Long schoolId, StaffPosition position, Long selfId);

    boolean existsBySchoolIdAndEmailIgnoreCaseAndIdNot(Long schoolId, String email, Long selfId);

    /** Cán bộ cùng trường có số điện thoại — so sau khi bỏ dấu cách, chấm, gạch (một trường vài trăm người). */
    List<Staff> findBySchoolIdAndPhoneIsNotNullAndIdNot(Long schoolId, Long selfId);
}
