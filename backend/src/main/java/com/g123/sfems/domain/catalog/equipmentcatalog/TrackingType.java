package com.g123.sfems.domain.catalog.equipmentcatalog;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Cách quản lý thiết bị: từng cái (có số serial) hay theo lô/số lượng. */
public enum TrackingType {

    SERIAL("serial"),
    BULK("bulk");

    private final String value;

    TrackingType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static TrackingType from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (TrackingType type : values()) {
            if (type.value.equalsIgnoreCase(raw) || type.name().equalsIgnoreCase(raw)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Cách quản lý không hợp lệ: " + raw);
    }
}
