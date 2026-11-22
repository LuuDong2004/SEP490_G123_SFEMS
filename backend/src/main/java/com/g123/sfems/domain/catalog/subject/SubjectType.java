package com.g123.sfems.domain.catalog.subject;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Môn học ở một cấp học là bắt buộc, lựa chọn hay tự chọn — theo chương trình
 * giáo dục phổ thông 2018. Ba giá trị đúng như enum {@code SubjectType} của bản
 * Jmix; đường truyền chữ thường theo quy ước của nền.
 */
public enum SubjectType {

    BAT_BUOC("bat_buoc"),
    LUA_CHON("lua_chon"),
    TU_CHON("tu_chon");

    private final String value;

    SubjectType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static SubjectType from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (SubjectType type : values()) {
            if (type.value.equalsIgnoreCase(raw) || type.name().equalsIgnoreCase(raw)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Loại môn học không hợp lệ: " + raw);
    }
}
