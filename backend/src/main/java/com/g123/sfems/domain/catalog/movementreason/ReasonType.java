package com.g123.sfems.domain.catalog.movementreason;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Loại của một lý do biến động tài sản.
 *
 * <p>Cùng quy ước đường truyền với {@code OrgStatus}: giá trị chữ thường trên
 * API, hằng số Java viết hoa. Lưu bằng tên ({@code EnumType.STRING}) chứ
 * không bằng thứ tự — thêm một giá trị vào giữa danh sách sẽ không lặng lẽ đổi
 * nghĩa những dòng đã lưu.
 *
 * <p>Năm giá trị lấy đúng từ enum {@code ReasonType} của bản Jmix. Hai giá trị
 * GHI_TANG và GHI_GIAM là hai loại mà dữ liệu mẫu thật sự dùng; bản Jmix không
 * có nhãn tiếng Việt cho chúng trong gói i18n, nhãn ở frontend là tự viết.
 */
public enum ReasonType {

    GHI_TANG("ghi_tang"),
    GHI_GIAM("ghi_giam"),
    DIEU_CHUYEN("dieu_chuyen"),
    SUA_CHUA("sua_chua"),
    THANH_LY("thanh_ly");

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
