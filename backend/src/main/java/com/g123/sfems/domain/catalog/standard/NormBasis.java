package com.g123.sfems.domain.catalog.standard;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Căn cứ tính số lượng định mức, theo cách phụ lục thông tư ghi cột "Số lượng": "01/lớp", "02"
 * (cả trường), "01/6HS", "01/GV", "07" trong danh mục tính cho một phòng học bộ môn.
 * {@code EquipmentNorm.basisSize} là mẫu số: "01/6HS" là PER_STUDENT với cỡ 6.
 */
public enum NormBasis {

    PER_CLASS("per_class"),
    PER_SCHOOL("per_school"),
    PER_STUDENT("per_student"),
    /** Mỗi giáo viên dạy môn đó. */
    PER_TEACHER("per_teacher"),
    /** Mỗi phòng học bộ môn — phụ lục ghi "danh mục tính cho 01 phòng học bộ môn". */
    PER_ROOM("per_room"),
    /**
     * Mỗi học sinh TRONG MỘT phòng học bộ môn / một lớp — "01/HS", "01/02HS" của thiết bị phòng bộ môn (máy tính phòng
     * Tin, giá vẽ, bàn ghế phòng ngoại ngữ…). Phụ lục tính cho một lớp {@link #ROOM_STUDENTS} học sinh, nên cần =
     * số lượng × ⌈{@link #ROOM_STUDENTS} ÷ cỡ nhóm⌉ × số phòng của môn (305).
     */
    PER_ROOM_STUDENT("per_room_student");

    /** Số học sinh một phòng học bộ môn / một lớp mà phụ lục tính ("1 lớp với số học sinh là 45"). */
    public static final int ROOM_STUDENTS = 45;

    private final String value;

    NormBasis(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static NormBasis from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (NormBasis basis : values()) {
            if (basis.value.equalsIgnoreCase(raw) || basis.name().equalsIgnoreCase(raw)) {
                return basis;
            }
        }
        throw new IllegalArgumentException("Căn cứ định mức không hợp lệ: " + raw);
    }
}
