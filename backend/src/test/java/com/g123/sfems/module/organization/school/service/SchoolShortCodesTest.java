package com.g123.sfems.module.organization.school.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.g123.sfems.domain.school.equipment.Equipment;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class SchoolShortCodesTest {

    @Test
    void coversEveryTwoCharCombinationWithoutDuplicates() {
        List<String> order = SchoolShortCodes.ORDER;
        assertEquals(36 * 36, order.size());
        assertEquals(order.size(), new HashSet<>(order).size());
        // Mỗi mã dựng được mã tài sản chuẩn.
        order.forEach(c -> assertTrue(Equipment.STANDARD_CODE.matcher("79." + c + ".08.TB.001.26").matches(), c));
    }

    @Test
    void keepsTheOldOrderFirstSoIssuedCodesDoNotMove() {
        List<String> order = SchoolShortCodes.ORDER;
        assertEquals("01", order.get(0));
        assertEquals("99", order.get(98));
        assertEquals("A0", order.get(99));
        assertEquals("Z9", order.get(99 + 259));
        assertEquals("AA", order.get(359));
        assertEquals("ZZ", order.get(1034));
        // Phần nối thêm cho đủ 1.099 trường của Sở.
        assertEquals("0A", order.get(1035));
        assertEquals("9Z", order.get(1294));
        assertEquals("00", order.get(1295));
    }

    @Test
    void nextSkipsTakenAndReservesTheCode() {
        Set<String> taken = new HashSet<>(List.of("01", "02"));
        assertEquals("03", SchoolShortCodes.next(taken));
        assertEquals("04", SchoolShortCodes.next(taken));
        assertTrue(taken.contains("03"));
    }

    @Test
    void enoughForTheSoListOfPublicSchools() {
        Set<String> taken = new HashSet<>();
        for (int i = 0; i < 1099; i++) {
            SchoolShortCodes.next(taken);
        }
        assertEquals(1099, taken.size());
    }
}
