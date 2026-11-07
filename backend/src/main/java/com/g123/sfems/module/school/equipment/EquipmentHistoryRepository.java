package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EquipmentHistoryRepository extends JpaRepository<EquipmentHistory, Long> {

    /** Mới nhất trước — màn lịch sử đọc từ trên xuống. */
    List<EquipmentHistory> findByEquipmentIdOrderByCreatedAtDescIdDesc(Long equipmentId);
}
