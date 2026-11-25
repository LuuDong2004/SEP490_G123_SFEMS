package com.g123.sfems.domain.catalog.equipmentconfig;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Kiểu dữ liệu của một thông số kỹ thuật. */
public enum AttributeDataType {

    TEXT("text"),
    INTEGER("integer"),
    DECIMAL("decimal"),
    BOOLEAN("boolean"),
    DATE("date"),
    /** Chọn một trong danh sách giá trị cho trước ({@code options}). */
    ENUM("enum");

    private final String value;

    AttributeDataType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static AttributeDataType from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (AttributeDataType type : values()) {
            if (type.value.equalsIgnoreCase(raw) || type.name().equalsIgnoreCase(raw)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Kiểu dữ liệu không hợp lệ: " + raw);
    }
}
