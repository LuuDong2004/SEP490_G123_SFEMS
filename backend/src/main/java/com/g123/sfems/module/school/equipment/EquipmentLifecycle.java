package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import com.g123.sfems.domain.school.equipment.EquipmentHistory.Action;
import com.g123.sfems.shared.security.CurrentUser;
import org.springframework.stereotype.Component;

/**
 * ĐƯỜNG DUY NHẤT để đổi trạng thái của một tài sản.
 *
 * <p>Mỗi hàm ở đây làm hai việc cùng lúc: đổi giá trị trên tài sản và ghi một dòng
 * {@link EquipmentHistory} kèm phiếu đã gây ra thay đổi. Nơi khác tự gọi {@code setStatus(...)} thì sổ
 * đổi mà lịch sử không biết, và câu "máy này vào trạng thái này từ bao giờ, theo phiếu nào" không ai trả
 * lời được.
 *
 * <p>Không gọi {@code save} ở đây: tài sản đang được quản lý trong giao dịch của người gọi và sẽ được
 * đẩy xuống khi giao dịch đóng.
 */
@Component
public class EquipmentLifecycle {

    /** Phiếu đã làm ra thay đổi — {@code null} khi là thao tác sửa tay hồ sơ. */
    public record VoucherRef(String resource, Long id, String code) {
    }

    private final EquipmentHistoryRepository history;

    public EquipmentLifecycle(EquipmentHistoryRepository history) {
        this.history = history;
    }

    public void status(Equipment item, AssetStatus status, Action action, VoucherRef voucher, String note) {
        String from = statusLabel(item.getStatus());
        item.setStatus(status);
        change(item, action, "status", from, statusLabel(status), voucher, note);
    }

    public void condition(Equipment item, EquipmentCondition condition, Action action, VoucherRef voucher,
            String note) {
        if (condition == null) {
            return;
        }
        String from = conditionLabel(item.getCondition());
        item.setCondition(condition);
        change(item, action, "condition", from, conditionLabel(condition), voucher, note);
    }

    /** Ghi một thay đổi trường dữ liệu. Gọi SAU khi đã gán giá trị mới trên tài sản. */
    public void change(Equipment item, Action action, String field, String from, String to, VoucherRef voucher,
            String note) {
        history.save(new EquipmentHistory(
                item.getId(), action, field, from, to,
                voucher == null ? null : voucher.resource(),
                voucher == null ? null : voucher.id(),
                voucher == null ? null : voucher.code(),
                note,
                CurrentUser.id().orElse(null),
                CurrentUser.username().orElse(null)));
    }

    /** Một sự kiện không đổi trường dữ liệu nào, ví dụ "ghi tăng" hay "kiểm kê khớp". */
    public void event(Equipment item, Action action, VoucherRef voucher, String note) {
        change(item, action, null, null, null, voucher, note);
    }

    public static String statusLabel(AssetStatus status) {
        if (status == null) {
            return null;
        }
        return switch (status) {
            case IN_STOCK -> "Trong kho";
            case IN_USE -> "Đang sử dụng";
            case BROKEN -> "Hỏng, chờ xử lý";
            case REPAIRING -> "Đang sửa chữa";
            case MISSING -> "Chờ ghi giảm do mất";
            case PENDING_LIQUIDATION -> "Chờ thanh lý";
            case LIQUIDATED -> "Đã thanh lý";
            case LOST -> "Mất";
        };
    }

    public static String conditionLabel(EquipmentCondition condition) {
        if (condition == null) {
            return null;
        }
        return switch (condition) {
            case TOT -> "Tốt";
            case KHA -> "Khá";
            case TRUNG_BINH -> "Trung bình";
            case KEM -> "Kém";
            case HONG -> "Hỏng";
            case KHONG_SU_DUNG -> "Không sử dụng được";
        };
    }
}
