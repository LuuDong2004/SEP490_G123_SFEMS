package com.g123.sfems.domain.school.voucher;

import static com.g123.sfems.domain.school.voucher.ApprovalStep.MANAGING_BODY;
import static com.g123.sfems.domain.school.voucher.ApprovalStep.SCHOOL;

import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Các loại phiếu mà quản trị viên CẤU HÌNH ĐƯỢC luồng phê duyệt (HT-08), cùng luồng MẶC ĐỊNH của từng loại — luồng dùng
 * khi chưa cấu hình gì ({@code approval_flows} không có dòng cho loại đó).
 *
 * <p>Đây là chỗ DUY NHẤT ghi luồng mặc định: {@code approvalChain()} của từng phiếu đọc lại từ đây, màn cấu hình cũng
 * vậy. Kế hoạch mua sắm (NC-06) do Sở lập, không nằm trong danh sách này.
 */
public enum ApprovalFlowType {
    EQUIPMENT_INTAKES("equipment_intakes", "Phiếu ghi tăng", "Thiết bị", EquipmentIntake.class,
            List.of(SCHOOL), null),
    INVENTORY_SESSIONS("inventory_sessions", "Biên bản kiểm kê", "Thiết bị", InventorySession.class,
            List.of(SCHOOL), null),
    PURCHASE_PROPOSALS("purchase_proposals", "Đề xuất mua sắm", "Mua sắm", PurchaseProposal.class,
            List.of(SCHOOL, MANAGING_BODY), "Tổng tiền đề xuất");

    private final String resource;
    private final String label;
    private final String module;
    private final Class<? extends SchoolVoucher> entity;
    private final List<ApprovalStep> defaultSteps;
    private final String amountLabel;

    ApprovalFlowType(String resource, String label, String module, Class<? extends SchoolVoucher> entity,
            List<ApprovalStep> defaultSteps, String amountLabel) {
        this.resource = resource;
        this.label = label;
        this.module = module;
        this.entity = entity;
        this.defaultSteps = defaultSteps;
        this.amountLabel = amountLabel;
    }

    /** Tên resource — cũng là khoá của dòng cấu hình. */
    public String resource() {
        return resource;
    }

    public String label() {
        return label;
    }

    /** Phân hệ chứa loại phiếu này — màn cấu hình gom theo đó. */
    public String module() {
        return module;
    }

    public List<ApprovalStep> defaultSteps() {
        return defaultSteps;
    }

    /** Tên của số tiền mà ngưỡng so với; {@code null} = loại phiếu này không đặt ngưỡng tiền được. */
    public String amountLabel() {
        return amountLabel;
    }

    public static Optional<ApprovalFlowType> of(String resource) {
        return Arrays.stream(values()).filter(t -> t.resource.equals(resource)).findFirst();
    }

    /** Loại của một phiếu. So bằng {@code isInstance} — phiếu nạp lười là lớp con proxy của Hibernate. */
    public static Optional<ApprovalFlowType> of(SchoolVoucher voucher) {
        return Arrays.stream(values()).filter(t -> t.entity.isInstance(voucher)).findFirst();
    }
}
