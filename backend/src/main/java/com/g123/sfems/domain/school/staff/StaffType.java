package com.g123.sfems.domain.school.staff;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Cán bộ (có phòng ban) hay giáo viên (có môn dạy). */
public enum StaffType {

    STAFF("staff"),
    TEACHER("teacher");

    private final String value;

    StaffType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static StaffType from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (StaffType type : values()) {
            if (type.value.equalsIgnoreCase(raw) || type.name().equalsIgnoreCase(raw)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Loại nhân sự không hợp lệ: " + raw);
    }
}
