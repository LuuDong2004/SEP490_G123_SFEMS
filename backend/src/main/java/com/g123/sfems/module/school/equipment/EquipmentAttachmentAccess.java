package com.g123.sfems.module.school.equipment;

import com.g123.sfems.shared.data.RecordAccess;
import org.springframework.stereotype.Component;

/**
 * Tệp đính kèm của THIẾT BỊ (TS-03, {@code resource = equipment}). Đọc được tệp là đọc được thiết bị đó,
 * ghi được tệp là ghi được thiết bị, theo đúng phạm vi dòng của {@link EquipmentService}.
 */
@Component
public class EquipmentAttachmentAccess implements RecordAccess {

    private final EquipmentService equipment;

    public EquipmentAttachmentAccess(EquipmentService equipment) {
        this.equipment = equipment;
    }

    @Override
    public String resource() {
        return "equipment";
    }

    @Override
    public void checkReadable(Long id) {
        equipment.get(id);
    }

    @Override
    public void checkWritable(Long id) {
        equipment.getWritable(id);
    }
}
