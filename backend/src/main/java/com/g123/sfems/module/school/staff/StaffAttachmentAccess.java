package com.g123.sfems.module.school.staff;

import com.g123.sfems.shared.data.RecordAccess;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Ảnh đại diện của cán bộ, giáo viên (trưởng nhóm, 13/11/2026): một tệp đính kèm dạng ảnh được đánh dấu đại diện,
 * kèm vùng cắt vuông — cùng cơ chế ảnh đại diện của thiết bị. Đọc / ghi ảnh là đọc / ghi được chính hồ sơ cán bộ,
 * theo phạm vi dòng của nó. Chỉ nhận ảnh JPG, PNG, WebP, tối đa 2 MB; nội dung tệp vẫn được kiểm chữ ký như mọi tệp.
 */
@Component
public class StaffAttachmentAccess implements RecordAccess {

    static final Set<String> IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    static final long MAX_BYTES = 2L * 1024 * 1024;

    private final StaffService staff;

    public StaffAttachmentAccess(StaffService staff) {
        this.staff = staff;
    }

    @Override
    public String resource() {
        return "staff";
    }

    @Override
    public Set<String> allowedExtensions() {
        return IMAGE_EXTENSIONS;
    }

    @Override
    public long maxBytes() {
        return MAX_BYTES;
    }

    @Override
    public void checkReadable(Long id) {
        staff.get(id);
    }

    @Override
    public void checkWritable(Long id) {
        staff.getWritable(id);
    }
}
