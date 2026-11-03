package com.g123.sfems.domain.school.inventory;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.facility.Room;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

/**
 * Một tài sản trên sổ lúc mở phiếu kiểm kê: sổ nói gì ({@code expected*}) và tổ kiểm kê thấy gì
 * ({@code found*}). {@code found == null} là chưa kiểm tới.
 */
@Entity
@Table(name = "inventory_lines")
public class InventoryLine {

    /** Loại chênh lệch. Một dòng có thể vừa sai vị trí vừa hỏng. */
    public enum Discrepancy {
        MISSING,
        WRONG_ROOM,
        DAMAGED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private InventorySession session;

    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "equipment_id", nullable = false)
    private Equipment equipment;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "expected_room_id")
    private Room expectedRoom;

    @Enumerated(EnumType.STRING)
    @Column(name = "expected_condition", length = 20)
    private EquipmentCondition expectedCondition;

    @Column
    private Boolean found;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "found_room_id")
    private Room foundRoom;

    @Enumerated(EnumType.STRING)
    @Column(name = "found_condition", length = 20)
    private EquipmentCondition foundCondition;

    @Column(length = 255)
    private String note;

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
        return result;
    }

    private static Long id(Room room) {
        return room == null ? null : room.getId();
    }

    public Long getId() {
        return id;
    }

    public InventorySession getSession() {
        return session;
    }

    public void setSession(InventorySession session) {
        this.session = session;
    }

    public Integer getLineNo() {
        return lineNo;
    }

    public void setLineNo(Integer lineNo) {
        this.lineNo = lineNo;
    }

    public Equipment getEquipment() {
        return equipment;
    }

    public void setEquipment(Equipment equipment) {
        this.equipment = equipment;
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

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
