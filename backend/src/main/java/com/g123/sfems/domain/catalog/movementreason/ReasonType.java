package com.g123.sfems.domain.catalog.movementreason;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Loại của một lý do biến động: chỉ còn ghi tăng (PN-01 là phiếu duy nhất làm tăng thiết bị).
 *
 * <p>Cùng quy ước đường truyền với {@code OrgStatus}: giá trị chữ thường trên
 * API, hằng số Java viết hoa. Lưu bằng tên ({@code EnumType.STRING}) chứ
 * không bằng thứ tự — thêm một giá trị vào giữa danh sách sẽ không lặng lẽ đổi
 * nghĩa những dòng đã lưu.
 */
public enum ReasonType {

    GHI_TANG("ghi_tang");

    private final String value;

    ReasonType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static ReasonType from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (ReasonType type : values()) {
            if (type.value.equalsIgnoreCase(raw) || type.name().equalsIgnoreCase(raw)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Loại lý do không hợp lệ: " + raw);
    }
}
