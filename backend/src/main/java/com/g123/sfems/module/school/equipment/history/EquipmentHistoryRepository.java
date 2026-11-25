package com.g123.sfems.module.school.equipment.history;

import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Không có phạm vi riêng: ai đọc được thiết bị thì đọc được lịch sử của nó — kiểm ở controller. */
public interface EquipmentHistoryRepository extends JpaRepository<EquipmentHistory, Long> {

    List<EquipmentHistory> findByEquipmentIdOrderByCreatedAtDescIdDesc(Long equipmentId);
}
