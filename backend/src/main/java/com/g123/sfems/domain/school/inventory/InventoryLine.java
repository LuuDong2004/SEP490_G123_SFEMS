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
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

/**
 * Một tài sản trên sổ lúc mở phiếu: sổ nói gì ({@code expected*}) và tổ kiểm kê
 * thấy gì ({@code found*}).
 *
 * <p>Không kế thừa {@code VoucherEquipmentLine}: dòng kiểm kê phải sống lâu hơn hồ sơ thiết bị (296). Thiết bị kiểm kê
 * ghi Mất thì hồ sơ xoá được, khoá ngoại thành {@code NULL}, còn biên bản đọc mã và tên từ bản chụp lúc lập phiếu. Liên
 * kết thiết bị vì thế phải {@code optional} — liên kết bắt buộc làm Hibernate nối INNER JOIN và dòng mất thiết bị biến
 * khỏi biên bản.
 */
@Entity
@Table(name = "inventory_lines")
public class InventoryLine {

    /** Loại chênh lệch. Một dòng có thể vừa sai vị trí vừa sai tình trạng vừa thiếu số lượng. */
    public enum Discrepancy {
        MISSING,
        WRONG_ROOM,
        /** Thấy, nhưng tình trạng thực tế khác tình trạng trên sổ — duyệt biên bản ghi tình trạng mới vào hồ sơ. */
        CONDITION,
        /** Hoá chất, vật tư theo lô: đếm được ít hơn số trên sổ. */
        SHORTAGE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private InventorySession session;

    /**
     * Thiết bị trên sổ. Nạp EAGER cùng dòng: đọc được phiếu thì đọc được những thiết bị phiếu nói tới. {@code null}:
     * hồ sơ đã bị xoá sau khi biên bản duyệt xong (chỉ thiết bị đã Mất mới xoá được).
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "equipment_id")
    private Equipment equipment;

    /** Mã thiết bị chụp lúc lập phiếu — biên bản vẫn đọc được khi hồ sơ đã xoá. */
    @Column(name = "equipment_code", length = 64)
    private String equipmentCode;

    @Column(name = "equipment_name", length = 255)
    private String equipmentName;

    @Column(length = 255)
    private String note;

    /** Trường chứng từ theo app Jmix cũ, JSON — hình dạng do {@code voucher-forms/*.json} quyết định. */
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String details = "{}";

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

    /**
     * Chênh lệch giữa sổ và thực tế. Rỗng là khớp (hoặc chưa kiểm). Cùng phép đếm với SQL của
     * {@code InventorySessionService.summaries}, {@code InventoryDiscrepancies} và báo cáo kiểm kê — đổi một bên thì
     * đổi các bên kia.
     */
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
        if (foundCondition != null && foundCondition != expectedCondition) {
            result.add(Discrepancy.CONDITION);
        }
        if (expectedQuantity != null && countedQuantity != null && countedQuantity.compareTo(expectedQuantity) < 0) {
            result.add(Discrepancy.SHORTAGE);
        }
        return result;
    }

    private static Long id(Room room) {
        return room == null ? null : room.getId();
    }

    public Long getId() {
        return id;
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

    /** Gắn thiết bị và chụp luôn mã, tên của nó. */
    public void setEquipment(Equipment equipment) {
        this.equipment = equipment;
        if (equipment != null) {
            this.equipmentCode = equipment.getCode();
            this.equipmentName = equipment.getName();
        }
    }

    /** Mã thiết bị: của hồ sơ khi còn, không thì bản chụp lúc lập phiếu. */
    public String getEquipmentCode() {
        return equipment != null ? equipment.getCode() : equipmentCode;
    }

    public String getEquipmentName() {
        return equipment != null ? equipment.getName() : equipmentName;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details == null ? "{}" : details;
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
