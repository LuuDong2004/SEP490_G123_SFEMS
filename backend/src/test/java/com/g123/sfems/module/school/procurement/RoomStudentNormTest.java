package com.g123.sfems.module.school.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.module.school.procurement.AdequacyService.Context;
import com.g123.sfems.module.school.procurement.AdequacyService.Requirement;
import com.g123.sfems.module.school.procurement.AdequacyService.School;
import com.g123.sfems.module.school.procurement.AdequacyService.SchoolClass;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * "01/HS" của thiết bị phòng bộ môn (305): mỗi học sinh trong MỘT phòng (45 em theo phụ lục) × số phòng của môn —
 * không nhân cả trường. Trường 2.152 học sinh, 6 phòng Tin: 270 máy, không phải 2.152.
 */
class RoomStudentNormTest {

    private static final long TIN_HOC = 9L;

    private static Context school(int students, Map<Long, Integer> rooms) {
        School s = new School(1L, "T", "THPT thử", "Trung học phổ thông", "THPT", null, 67, students);
        List<SchoolClass> classes = List.of(new SchoolClass(10, students));
        return new Context(s, classes, new int[] {10, 11, 12}, Map.of(), 0, rooms);
    }

    private static Map<String, Object> norm(String basis, int qty, Integer size) {
        Map<String, Object> n = new HashMap<>();
        n.put("min_quantity", BigDecimal.valueOf(qty));
        n.put("basis_size", size);
        n.put("norm_basis", basis);
        n.put("subject_id", TIN_HOC);
        n.put("subject_code", "TIN_HOC");
        return n;
    }

    @Test
    void perStudentInRoomTimesRooms() {
        Requirement r = school(2152, Map.of(TIN_HOC, 6)).required(norm("PER_ROOM_STUDENT", 1, null));
        assertThat(r.value()).isEqualTo(270);
        assertThat(r.warning()).isNull();
    }

    @Test
    void groupSizeDividesStudentsOfOneRoom() {
        // "01/02HS": 45 em → 23 bộ một phòng; "01/03HS" → 15.
        assertThat(school(2152, Map.of(TIN_HOC, 1)).required(norm("PER_ROOM_STUDENT", 1, 2)).value()).isEqualTo(23);
        assertThat(school(2152, Map.of(TIN_HOC, 1)).required(norm("PER_ROOM_STUDENT", 1, 3)).value()).isEqualTo(15);
    }

    @Test
    void noRoomDeclaredCountsOneRoomWithWarning() {
        Requirement r = school(2152, Map.of()).required(norm("PER_ROOM_STUDENT", 1, null));
        assertThat(r.value()).isEqualTo(45);
        assertThat(r.warning()).contains("tính một phòng");
    }

    @Test
    void wholeSchoolStudentBasisUnchanged() {
        // Căn cứ cũ (mỗi học sinh của cả trường) vẫn tính như trước cho dòng thật sự theo học sinh.
        assertThat(school(90, Map.of()).required(norm("PER_STUDENT", 1, 6)).value()).isEqualTo(15);
    }
}
