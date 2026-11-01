package com.g123.sfems.domain.school.voucher;

import static com.g123.sfems.domain.school.voucher.ApprovalStep.MANAGING_BODY;
import static com.g123.sfems.domain.school.voucher.ApprovalStep.SCHOOL;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Các loại phiếu đi qua vòng duyệt chung, cùng luồng MẶC ĐỊNH của từng loại — luồng dùng khi quản
 * trị viên chưa cấu hình gì (bảng {@code approval_flows} không có dòng cho loại đó).
 *
 * <p>Đây là chỗ DUY NHẤT ghi luồng mặc định. Thêm một loại phiếu mới = thêm một dòng ở đây; mã
 * {@code resource} phải trùng {@link SchoolVoucher#resource()} của entity tương ứng.
 *
 * <p>Theo Báo cáo 3 mục 4.4: đề xuất mua sắm của trường do lãnh đạo trường duyệt rồi lãnh đạo Sở
 * duyệt (NC-03, NC-04); phiếu nhập và phiếu kiểm kê chỉ lãnh đạo trường duyệt (PN-02, KK-05).
 */
public enum ApprovalFlowType {
    PURCHASE_PROPOSALS("purchase_proposals", "Đề xuất mua sắm", "MS",
            List.of(SCHOOL, MANAGING_BODY), "Tổng tiền đề xuất"),
    EQUIPMENT_INTAKES("equipment_intakes", "Phiếu nhập thiết bị", "NK",
            List.of(SCHOOL), "Tổng tiền phiếu"),
    INVENTORY_SESSIONS("inventory_sessions", "Phiếu kiểm kê", "KK",
            List.of(SCHOOL), null);

    private final String resource;
    private final String label;
    private final String numberPrefix;
    private final List<ApprovalStep> defaultSteps;
    private final String amountLabel;

    ApprovalFlowType(String resource, String label, String numberPrefix, List<ApprovalStep> defaultSteps,
            String amountLabel) {
        this.resource = resource;
        this.label = label;
        this.numberPrefix = numberPrefix;
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

    /** Tiền tố số phiếu mặc định của loại phiếu. */
    public String numberPrefix() {
        return numberPrefix;
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

    public static Optional<ApprovalFlowType> of(SchoolVoucher voucher) {
        return of(voucher.resource());
    }
}
