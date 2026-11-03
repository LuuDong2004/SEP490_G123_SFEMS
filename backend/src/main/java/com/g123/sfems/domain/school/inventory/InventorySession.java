package com.g123.sfems.domain.school.inventory;

import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.BatchSize;

/**
 * Phiếu kiểm kê của một trường (KK-03..KK-07) — cũng là biên bản kiểm kê.
 *
 * <p>Lúc lập, phiếu CHỤP sổ tài sản (cả trường, hoặc một phòng): mỗi tài sản một dòng, ghi sổ nói nó ở
 * đâu và tình trạng gì. Tổ kiểm kê đi đếm và ghi cái thấy thật. Chênh lệch là khoảng cách giữa hai cột.
 *
 * <p>Biên bản KHÔNG sửa thẳng sổ. Lãnh đạo trường duyệt xong thì mỗi loại chênh lệch được xử lý tiếp —
 * thiếu thì đánh dấu {@code MISSING}, hỏng thì {@code BROKEN}, sai vị trí thì cập nhật phòng, thừa thì
 * lập phiếu nhập nháp — và ghi vào lịch sử thiết bị.
 */
@RowLevelResource("inventory_sessions")
@Entity
@Table(name = "inventory_sessions")
public class InventorySession extends SchoolVoucher {

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "campaign_id")
    private InventoryCampaign campaign;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "inventory_date", nullable = false)
    private LocalDate inventoryDate;

    /** Kiểm kê một phòng. Trống là cả trường. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "room_id")
    private Room room;

    /** Thành phần tổ kiểm kê. */
    @Column(length = 1000)
    private String council;

    @Column(length = 2000)
    private String conclusion;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNo ASC")
    @BatchSize(size = 50)
    private List<InventoryLine> lines = new ArrayList<>();

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNo ASC")
    @BatchSize(size = 50)
    private List<InventorySurplus> surplus = new ArrayList<>();

    @Override
    public String resource() {
        return "inventory_sessions";
    }

    @Override
    public String numberPrefix() {
        return "KK";
    }

    @Override
    public LocalDate documentDate() {
        return inventoryDate;
    }

    public InventoryCampaign getCampaign() {
        return campaign;
    }

    public void setCampaign(InventoryCampaign campaign) {
        this.campaign = campaign;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public LocalDate getInventoryDate() {
        return inventoryDate;
    }

    public void setInventoryDate(LocalDate inventoryDate) {
        this.inventoryDate = inventoryDate;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public String getCouncil() {
        return council;
    }

    public void setCouncil(String council) {
        this.council = council;
    }

    public String getConclusion() {
        return conclusion;
    }

    public void setConclusion(String conclusion) {
        this.conclusion = conclusion;
    }

    public List<InventoryLine> getLines() {
        return lines;
    }

    public void replaceLines(List<InventoryLine> replacement) {
        lines.clear();
        if (replacement != null) {
            for (InventoryLine line : replacement) {
                line.setSession(this);
                lines.add(line);
            }
        }
    }

    public List<InventorySurplus> getSurplus() {
        return surplus;
    }

    public void replaceSurplus(List<InventorySurplus> replacement) {
        surplus.clear();
        if (replacement != null) {
            for (InventorySurplus item : replacement) {
                item.setSession(this);
                surplus.add(item);
            }
        }
    }
}
