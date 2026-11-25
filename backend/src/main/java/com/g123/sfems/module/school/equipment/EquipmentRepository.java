package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.module.school.base.SchoolOwnedRepository;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EquipmentRepository extends SchoolOwnedRepository<Equipment> {

    /**
     * Mã các tài sản khác của trường đang mang số serial này (đã chuẩn hoá: bỏ khoảng trắng hai đầu, chữ
     * thường). Đọc KHÔNG qua phạm vi dòng, cố ý: serial duy nhất trong cả trường, kể cả tài sản người gọi
     * không được xem — câu từ chối chỉ nêu mã tài sản, không lộ gì thêm.
     */
    @Query("select e.code from Equipment e where e.school.id = :schoolId"
            + " and lower(trim(e.serialNumber)) = :serial and e.id <> :excludeId and e.status not in :offBook"
            + " order by e.code")
    List<String> codesWithSerial(@Param("schoolId") Long schoolId, @Param("serial") String serial,
            @Param("excludeId") Long excludeId, @Param("offBook") Collection<AssetStatus> offBook);
}
