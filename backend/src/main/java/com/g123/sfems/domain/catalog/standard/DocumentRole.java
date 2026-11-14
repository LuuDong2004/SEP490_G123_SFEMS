package com.g123.sfems.domain.catalog.standard;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Vai trò của một văn bản căn cứ trong bộ tiêu chuẩn. */
public enum DocumentRole {

    MAIN("main"),
    AMENDMENT("amendment"),
    GUIDANCE("guidance"),
    REPLACEMENT("replacement"),
    REFERENCE("reference");

    private final String value;

    DocumentRole(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static DocumentRole from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (DocumentRole role : values()) {
            if (role.value.equalsIgnoreCase(raw) || role.name().equalsIgnoreCase(raw)) {
                return role;
            }
        }
        throw new IllegalArgumentException("Vai trò văn bản không hợp lệ: " + raw);
    }
}
