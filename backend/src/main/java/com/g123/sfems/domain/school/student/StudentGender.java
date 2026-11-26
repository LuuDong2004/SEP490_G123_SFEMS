package com.g123.sfems.domain.school.student;

/** Giới tính của học sinh — lưu tên hằng ({@code MALE} / {@code FEMALE}), trống là chưa khai. */
public enum StudentGender {

    MALE("Nam"),
    FEMALE("Nữ");

    private final String label;

    StudentGender(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
