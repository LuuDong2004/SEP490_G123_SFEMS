package com.g123.sfems.domain.catalog.equipmentcatalog;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Phương pháp khấu hao. */
public enum DepreciationMethod {

    STRAIGHT_LINE("straight_line"),
    DECLINING_BALANCE("declining_balance"),
    UNITS_OF_OUTPUT("units_of_output");

    private final String value;

    DepreciationMethod(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static DepreciationMethod from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (DepreciationMethod method : values()) {
            if (method.value.equalsIgnoreCase(raw) || method.name().equalsIgnoreCase(raw)) {
                return method;
            }
        }
        throw new IllegalArgumentException("Phương pháp khấu hao không hợp lệ: " + raw);
    }
}
