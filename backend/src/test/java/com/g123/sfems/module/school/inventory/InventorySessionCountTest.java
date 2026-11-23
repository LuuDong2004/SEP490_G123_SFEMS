package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventoryLine.Discrepancy;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet countSession — KK-04 Ghi kết quả kiểm đếm: {@link InventorySessionService#count}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventorySessionCountTest {

    InventoryFixture f;
    InventorySession session;
    InventoryLine projectorLine;
    InventoryLine naclLine;

    long lineId;
    Boolean found;
    Long foundRoom;
    EquipmentCondition foundCondition;
    BigDecimal countedQuantity;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.officerOfSchool1();
        projectorLine = InventoryFixture.line(11L, 1, f.projectorItem(11L, "TB-001"));
        naclLine = InventoryFixture.line(13L, 2, f.naclLot());
        session = f.session(VoucherStatus.DRAFT, projectorLine, naclLine);
        lineId = 11L;
        found = true;
        foundRoom = null;
        foundCondition = null;
        countedQuantity = null;
    }

    private InventorySession count() {
        InventorySessionApi.CountLine input = new InventorySessionApi.CountLine(lineId, found,
                foundRoom == null ? null : new IdRef(foundRoom), foundCondition, countedQuantity, "  Đã dán tem  ", null);
        return f.sessionService.count(20L, new InventorySessionApi.Count(List.of(input)));
    }

    private void assertSaved() {
        count();
        verify(f.sessions).persist(session);
    }

    private void assertRefused(String message) {
        assertThatThrownBy(this::count).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verify(f.sessions, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: thấy, giữ phòng và tình trạng theo sổ → khớp, ghi chú đã trim")
    void utcid01() {
        assertSaved();
        assertThat(projectorLine.getFound()).isTrue();
        assertThat(projectorLine.getFoundRoom()).isSameAs(f.room101);
        assertThat(projectorLine.getFoundCondition()).isEqualTo(EquipmentCondition.TOT);
        assertThat(projectorLine.discrepancies()).isEmpty();
        assertThat(projectorLine.getNote()).isEqualTo("Đã dán tem");
    }

    @Test
    @DisplayName("UTCID02 - N: không thấy → chênh lệch Thiếu (MISSING)")
    void utcid02() {
        found = false;
        assertSaved();
        assertThat(projectorLine.discrepancies()).containsExactly(Discrepancy.MISSING);
        assertThat(projectorLine.getFoundRoom()).isNull();
        assertThat(projectorLine.getFoundCondition()).isNull();
    }

    @Test
    @DisplayName("UTCID03 - N: thấy ở phòng 102 (sổ: 101) → Sai vị trí (WRONG_ROOM)")
    void utcid03() {
        foundRoom = 102L;
        assertSaved();
        assertThat(projectorLine.discrepancies()).containsExactly(Discrepancy.WRONG_ROOM);
        assertThat(projectorLine.getFoundRoom()).isSameAs(f.room102);
    }

    @Test
    @DisplayName("UTCID04 - N: thấy nhưng hỏng (sổ: Tốt) → Hỏng (DAMAGED)")
    void utcid04() {
        foundCondition = EquipmentCondition.HONG;
        assertSaved();
        assertThat(projectorLine.discrepancies()).containsExactly(Discrepancy.DAMAGED);
    }

    @Test
    @DisplayName("UTCID05 - A: phòng thấy thuộc trường 2 → MSG44")
    void utcid05() {
        foundRoom = 201L;
        assertRefused("Phòng tìm thấy không thuộc trường của phiếu");
    }

    @Test
    @DisplayName("UTCID06 - N: lô NaCl đếm 480 / 500 → Thiếu số lượng (SHORTAGE)")
    void utcid06() {
        lineId = 13L;
        countedQuantity = new BigDecimal("480");
        assertSaved();
        assertThat(naclLine.getCountedQuantity()).isEqualByComparingTo("480");
        assertThat(naclLine.discrepancies()).containsExactly(Discrepancy.SHORTAGE);
    }

    @Test
    @DisplayName("UTCID07 - B: lô NaCl không nhập số đếm → lấy số theo sổ 500, khớp")
    void utcid07() {
        lineId = 13L;
        assertSaved();
        assertThat(naclLine.getCountedQuantity()).isEqualByComparingTo("500");
        assertThat(naclLine.discrepancies()).isEmpty();
    }

    @Test
    @DisplayName("UTCID08 - B: lô NaCl đếm được 0 → Thiếu số lượng")
    void utcid08() {
        lineId = 13L;
        countedQuantity = BigDecimal.ZERO;
        assertSaved();
        assertThat(naclLine.getCountedQuantity()).isEqualByComparingTo("0");
        assertThat(naclLine.discrepancies()).containsExactly(Discrepancy.SHORTAGE);
    }

    @Test
    @DisplayName("UTCID09 - A: số đếm âm (-1) → \"Số lượng đếm được không được âm\"")
    void utcid09() {
        lineId = 13L;
        countedQuantity = new BigDecimal("-1");
        assertRefused("Số lượng đếm được không được âm");
    }

    @Test
    @DisplayName("UTCID10 - B: bỏ đánh dấu (found = null) → dòng về Chưa kiểm")
    void utcid10() {
        InventoryFixture.counted(projectorLine, true, f.room101, EquipmentCondition.TOT);
        found = null;
        assertSaved();
        assertThat(projectorLine.getFound()).isNull();
        assertThat(projectorLine.getFoundRoom()).isNull();
        assertThat(projectorLine.discrepancies()).isEmpty();
    }

    @Test
    @DisplayName("UTCID11 - A: dòng 99 không thuộc phiếu → \"Dòng không thuộc phiếu này\"")
    void utcid11() {
        lineId = 99L;
        assertRefused("Dòng không thuộc phiếu này");
    }

    @Test
    @DisplayName("UTCID12 - A: biên bản đã trình (Chờ duyệt) → chỉ xem, không ghi được (GBR-03)")
    void utcid12() {
        session.setStatus(VoucherStatus.PENDING);
        assertRefused("Chỉ sửa được phiếu nháp — phiếu đã trình thì phải được trả lại mới sửa");
        assertThat(projectorLine.getFound()).isNull();
    }
}
