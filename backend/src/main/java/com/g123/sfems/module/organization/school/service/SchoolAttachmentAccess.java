package com.g123.sfems.module.organization.school.service;

import com.g123.sfems.shared.data.RecordAccess;
import org.springframework.stereotype.Component;

/**
 * Tệp đính kèm của TRƯỜNG ({@code resource = schools}) — ảnh trường (ảnh đầu / ảnh được đánh dấu
 * là ảnh đại diện) hiện ở hộp thoại "Hồ sơ trường". Đọc / ghi được tệp là đọc / ghi được chính
 * trường đó, theo phạm vi dòng của {@code schools}.
 */
@Component
public class SchoolAttachmentAccess implements RecordAccess {

    private final SchoolService schools;

    public SchoolAttachmentAccess(SchoolService schools) {
        this.schools = schools;
    }

    @Override
    public String resource() {
        return "schools";
    }

    @Override
    public void checkReadable(Long id) {
        schools.get(id);
    }

    @Override
    public void checkWritable(Long id) {
        schools.getWritable(id);
    }
}
