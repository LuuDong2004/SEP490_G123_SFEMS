package com.g123.sfems.domain.school.inventory;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.school.facility.Room;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Tài sản THỪA: thấy thực tế nhưng không có trên sổ. Duyệt biên bản xong, các dòng này thành một phiếu
 * nhập nháp — ghi tăng vẫn phải qua lãnh đạo trường duyệt như mọi lần ghi tăng khác.
 */
@Entity
@Table(name = "inventory_surplus")
public class InventorySurplus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private InventorySession session;

    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "catalog_id", nullable = false)
    private EquipmentCatalog catalog;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false)
    private Integer quantity;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "room_id")
    private Room room;

    @Column(length = 255)
    private String note;

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

    public EquipmentCatalog getCatalog() {
        return catalog;
    }

    public void setCatalog(EquipmentCatalog catalog) {
        this.catalog = catalog;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
