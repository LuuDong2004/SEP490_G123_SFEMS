package com.g123.sfems.domain.catalog.movementreason;

import com.fasterxml.jackson.annotation.JsonValue;

/** Chiều của một lý do biến động. Trên JSON viết thường (`increase`), trong DB viết hoa. */
public enum MovementDirection {
    INCREASE,
    DECREASE;

    @JsonValue
    public String json() {
        return name().toLowerCase();
    }

    /** Đọc cả hai kiểu viết từ query string và body; giá trị lạ trả null để bên gọi báo lỗi. */
    public static MovementDirection parse(String value) {
        if (value == null) {
            return null;
        }
        try {
            return MovementDirection.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
