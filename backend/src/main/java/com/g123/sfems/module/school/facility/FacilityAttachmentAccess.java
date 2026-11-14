package com.g123.sfems.module.school.facility;

import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.shared.data.RecordAccess;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Tệp đính kèm của cơ sở vật chất: ảnh hiện trạng, bản vẽ, hồ sơ pháp lý của cơ sở, khối nhà và
 * phòng (QLTB-150). Đọc / ghi được tệp là đọc / ghi được chính bản ghi đó, theo phạm vi dòng của
 * nó — không có mã quyền riêng cho tệp.
 */
@Configuration
public class FacilityAttachmentAccess {

    @Bean
    RecordAccess campusAttachmentAccess(CampusService campuses) {
        return access("campuses", campuses);
    }

    @Bean
    RecordAccess buildingAttachmentAccess(BuildingService buildings) {
        return access("buildings", buildings);
    }

    @Bean
    RecordAccess roomAttachmentAccess(RoomService rooms) {
        return access("rooms", rooms);
    }

    private static RecordAccess access(String resource, CatalogService<?, ?, ?> service) {
        return new RecordAccess() {
            @Override
            public String resource() {
                return resource;
            }

            @Override
            public void checkReadable(Long id) {
                service.get(id);
            }

            @Override
            public void checkWritable(Long id) {
                service.getWritable(id);
            }
        };
    }
}
