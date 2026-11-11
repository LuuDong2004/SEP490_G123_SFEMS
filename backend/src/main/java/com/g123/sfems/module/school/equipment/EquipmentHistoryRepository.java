package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface EquipmentHistoryRepository extends JpaRepository<EquipmentHistory, Long> {

    /** Mới nhất trước — màn lịch sử đọc từ trên xuống. */
    List<EquipmentHistory> findByEquipmentIdOrderByCreatedAtDescIdDesc(Long equipmentId);

    /**
     * Tài sản từng mang mã này rồi bị đổi sang mã khác (TS-05). Mã cũ nằm ở {@code fromValue} của dòng đổi
     * mã, nên tra được cả mã trung gian không còn chỗ nào khác giữ. {@code code} phải là chữ thường.
     */
    @Query("select distinct h.equipmentId from EquipmentHistory h"
            + " where h.field = 'code' and lower(h.fromValue) = :code")
    List<Long> findEquipmentIdsByPastCode(@Param("code") String code);
}
