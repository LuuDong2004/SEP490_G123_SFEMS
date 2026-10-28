package com.g123.sfems.domain.organization;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Đơn vị (Sở/Phòng GD, trường học) còn hoạt động hay đã ngưng.
 *
 * <p>Cùng quy ước đường truyền với {@code OrganizationStatus} và
 * {@code UserStatus}: màn quản trị gửi và hiển thị giá trị chữ thường, còn
 * hằng số Java giữ cách viết thông thường.
 *
 * <p>Một enum dùng chung cho cả Sở lẫn Trường chứ không phải hai bản sao giống
 * hệt nhau: hai loại đơn vị này trả lời cùng một câu hỏi — còn vận hành hay đã
 * ngưng — và tách ra chỉ tạo ra hai danh sách phải giữ khớp bằng tay. Ngày nào
 * một trong hai cần trạng thái riêng (ví dụ trường "đang sáp nhập") thì tách,
 * và lúc đó việc tách mang thông tin thật.
 *
 * <p>Ngưng hoạt động là thứ giao diện mời làm THAY CHO xoá: khoá ngoại
 * {@code RESTRICT} vốn đã từ chối xoá một Sở còn trường trực thuộc.
 */
public enum OrgStatus {

    /** Đang hoạt động — mặc định cho bản ghi mới tạo. */
    ACTIVE("active"),

    /** Đã ngưng. Giữ lại vì những bản ghi khác còn trỏ vào. */
    INACTIVE("inactive");

    private final String value;

    OrgStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static OrgStatus from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (OrgStatus status : values()) {
            if (status.value.equalsIgnoreCase(raw) || status.name().equalsIgnoreCase(raw)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Trạng thái đơn vị không hợp lệ: " + raw);
    }
}
