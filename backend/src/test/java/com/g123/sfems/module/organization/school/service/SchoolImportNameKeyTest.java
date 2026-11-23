package com.g123.sfems.module.organization.school.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;

/** Ghép trường theo tên khi nhập danh sách trường: cùng một trường viết nhiều kiểu thì ra cùng một khoá. */
class SchoolImportNameKeyTest {

    private static String key(String name) {
        return SchoolImportService.nameKey(name, 1L);
    }

    @Test
    void sameSchoolWrittenDifferently() {
        assertEquals(key("Tiểu Học Nguyễn Bỉnh Khiêm"), key("Trường Tiểu học Nguyễn Bỉnh Khiêm"));
        assertEquals(key("TH Nguyễn Bỉnh Khiêm"), key("Trường tiểu học  Nguyễn Bỉnh Khiêm"));
        assertEquals(key("THCS Minh Đức"), key("Trường Trung học cơ sở Minh Đức"));
        assertEquals(key("THPT Chuyên Lê Hồng Phong"), key("Trường THPT chuyên Lê Hồng Phong"));
        assertEquals(key("Lê Thị Riêng"), key("Tiểu học, THCS và THPT Lê Thị Riêng"));
    }

    @Test
    void keepsWordsThatArePartOfTheName() {
        assertEquals("so 1|1", key("Tiểu học Số 1"));
        assertEquals("truong son|1", key("THCS Trường Sơn"));
        assertNotEquals(key("Tiểu học Số 1"), key("Tiểu học Số 2"));
    }

    @Test
    void levelIsPartOfTheKey() {
        assertNotEquals(SchoolImportService.nameKey("Trần Văn Ơn", 1L), SchoolImportService.nameKey("Trần Văn Ơn", 2L));
    }
}
