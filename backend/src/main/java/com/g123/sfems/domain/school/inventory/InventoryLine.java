package com.g123.sfems.domain.school.inventory;

import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.voucher.VoucherEquipmentLine;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

/**
 * Một tài sản trên sổ lúc mở phiếu: sổ nói gì ({@code expected*}) và tổ kiểm kê
 * thấy gì ({@code found*}).
 */
@Entity
@Table(name = "inventory_lines")
public class InventoryLine extends VoucherEquipmentLine {

    /** Loại chênh lệch. Một dòng có thể vừa sai vị trí vừa hỏng. */
    public enum Discrepancy {
        MISSING,
        WRONG_ROOM,
        DAMAGED,
        /** Hoá chất, vật tư theo lô: đếm được ít hơn số trên sổ. */
        SHORTAGE
    }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private InventorySession session;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "expected_room_id")
    private Room expectedRoom;

    @Enumerated(EnumType.STRING)
    @Column(name = "expected_condition", length = 20)
    private EquipmentCondition expectedCondition;

    /** {@code null}: chưa kiểm tới. */
    @Column
    private Boolean found;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "found_room_id")
    private Room foundRoom;

    @Enumerated(EnumType.STRING)
    @Column(name = "found_condition", length = 20)
    private EquipmentCondition foundCondition;

    /** Số lượng trên sổ lúc lập phiếu — chỉ có ở tài sản quản lý theo số lượng (hoá chất, vật tư theo lô). */
    @Column(name = "expected_quantity", precision = 18, scale = 3)
    private BigDecimal expectedQuantity;

    /** Số đếm được; {@code null} = chưa đếm (coi như đủ khi đã ghi "có"). */
    @Column(name = "counted_quantity", precision = 18, scale = 3)
    private BigDecimal countedQuantity;

    /** Chênh lệch giữa sổ và thực tế. Rỗng là khớp (hoặc chưa kiểm). */
    public Set<Discrepancy> discrepancies() {
        Set<Discrepancy> result = EnumSet.noneOf(Discrepancy.class);
        if (found == null) {
            return result;
        }
        if (!found) {
            result.add(Discrepancy.MISSING);
            return result;
        }
        if (!Objects.equals(id(expectedRoom), id(foundRoom))) {
            result.add(Discrepancy.WRONG_ROOM);
        }
        if (foundCondition == EquipmentCondition.HONG && expectedCondition != EquipmentCondition.HONG) {
            result.add(Discrepancy.DAMAGED);
        }
        if (expectedQuantity != null && countedQuantity != null && countedQuantity.compareTo(expectedQuantity) < 0) {
            result.add(Discrepancy.SHORTAGE);
        }
        return result;
    }

    private static Long id(Room room) {
        return room == null ? null : room.getId();
    }

    public InventorySession getSession() {
        return session;
    }

    public void setSession(InventorySession session) {
        this.session = session;
    }

    public BigDecimal getExpectedQuantity() {
        return expectedQuantity;
    }

    public void setExpectedQuantity(BigDecimal expectedQuantity) {
        this.expectedQuantity = expectedQuantity;
    }

    public BigDecimal getCountedQuantity() {
        return countedQuantity;
    }

    public void setCountedQuantity(BigDecimal countedQuantity) {
        this.countedQuantity = countedQuantity;
    }

    public Room getExpectedRoom() {
        return expectedRoom;
    }

    public void setExpectedRoom(Room expectedRoom) {
        this.expectedRoom = expectedRoom;
    }

    public EquipmentCondition getExpectedCondition() {
        return expectedCondition;
    }

    public void setExpectedCondition(EquipmentCondition expectedCondition) {
        this.expectedCondition = expectedCondition;
    }

    public Boolean getFound() {
        return found;
    }

    public void setFound(Boolean found) {
        this.found = found;
    }

    public Room getFoundRoom() {
        return foundRoom;
    }

    public void setFoundRoom(Room foundRoom) {
        this.foundRoom = foundRoom;
    }

    public EquipmentCondition getFoundCondition() {
        return foundCondition;
    }

    public void setFoundCondition(EquipmentCondition foundCondition) {
        this.foundCondition = foundCondition;
    }
}
