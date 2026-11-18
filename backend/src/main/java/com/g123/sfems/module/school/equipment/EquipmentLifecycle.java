package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentHistory.Action;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.module.school.equipment.history.EquipmentHistoryService;
import com.g123.sfems.module.school.equipment.history.EquipmentHistoryService.VoucherRef;
import org.springframework.stereotype.Component;

/**
 * ĐƯỜNG DUY NHẤT để một phiếu đổi trạng thái của tài sản.
 *
 * <p>Mỗi setter ở đây làm hai việc cùng lúc: đổi giá trị trên tài sản và ghi một
 * dòng lịch sử kèm phiếu đã làm ra thay đổi. Phiếu nào tự gọi
 * {@code equipment.setRoom(...)} thì sổ đổi mà lịch sử không biết, và câu "máy
 * này về phòng này từ bao giờ, theo phiếu nào" không còn ai trả lời được.
 *
 * <p>Không lưu: tài sản được lấy ra trong giao dịch của phiếu, nên nó đã được
 * quản lý và sẽ được đẩy xuống khi giao dịch đóng.
 */
@Component
public class EquipmentLifecycle {

    private final EquipmentHistoryService history;

    public EquipmentLifecycle(EquipmentHistoryService history) {
        this.history = history;
    }

    public void room(Equipment item, Room room, Action action, VoucherRef voucher, String note) {
        String from = roomLabel(item.getRoom());
        item.setRoom(room);
        history.change(item, action, "room", from, roomLabel(room), voucher, note);
    }

    /**
     * Người quản lý khi một phiếu đặt tài sản vào một phòng: người nhận ghi trên phiếu; phiếu không ghi thì
     * CÁN BỘ PHỤ TRÁCH PHÒNG đó. Tài sản ghi tăng về kho là đang nằm trong tay thủ kho — để trống người quản
     * lý là hồ sơ nói sai, và cán bộ phải mở từng hồ sơ ra điền tay (phản hồi của BA). Thu hồi về kho, nhận
     * điều chuyển và cấp phát bỏ trống người nhận đi cùng quy tắc này. Phòng chưa khai cán bộ phụ trách
     * (hoặc không có phòng) thì trống, vì không có ai để điền.
     */
    public static Staff keeperOf(Staff receiver, Room room) {
        if (receiver != null) {
            return receiver;
        }
        return room == null ? null : room.getManagingStaff();
    }

    public void manager(Equipment item, Staff manager, Action action, VoucherRef voucher, String note) {
        String from = staffLabel(item.getManager());
        item.setManager(manager);
        history.change(item, action, "manager", from, staffLabel(manager), voucher, note);
    }

    public void status(Equipment item, AssetStatus status, Action action, VoucherRef voucher, String note) {
        String from = statusLabel(item.getStatus());
        item.setStatus(status);
        history.change(item, action, "status", from, statusLabel(status), voucher, note);
    }

    public void condition(Equipment item, EquipmentCondition condition, Action action, VoucherRef voucher,
            String note) {
        if (condition == null) {
            return;
        }
        String from = conditionLabel(item.getCondition());
        item.setCondition(condition);
        history.change(item, action, "condition", from, conditionLabel(condition), voucher, note);
    }

    public void school(Equipment item, School school, Action action, VoucherRef voucher, String note) {
        String from = item.getSchool() == null ? null : item.getSchool().getName();
        item.setSchool(school);
        history.change(item, action, "school", from, school.getName(), voucher, note);
    }

    /** Giá trị còn lại sau một lần tính hao mòn / khấu hao. */
    public void remainingValue(Equipment item, java.math.BigDecimal value, Action action, VoucherRef voucher,
            String note) {
        String from = item.getRemainingValue() == null ? null : item.getRemainingValue().toPlainString();
        item.setRemainingValue(value);
        history.change(item, action, "remainingValue", from, value == null ? null : value.toPlainString(), voucher,
                note);
    }

    /** Một sự kiện không đổi trường dữ liệu nào (vd. bảo trì định kỳ xong). */
    public void event(Equipment item, Action action, VoucherRef voucher, String note) {
        history.event(item, action, voucher, note);
    }

    static String roomLabel(Room room) {
        return room == null ? "Kho" : room.getName();
    }

    static String staffLabel(Staff staff) {
        return staff == null ? null : staff.getName();
    }

    public static String statusLabel(AssetStatus status) {
        if (status == null) {
            return null;
        }
        return switch (status) {
            case IN_STOCK -> "Trong kho";
            case IN_USE -> "Đang sử dụng";
            case BORROWED -> "Đang cho mượn";
            case BROKEN -> "Hỏng, chờ xử lý";
            case UNREPAIRABLE -> "Hỏng, không sửa được";
            case REPAIRING -> "Đang sửa chữa";
            case WARRANTY -> "Đang bảo hành";
            case MAINTAINING -> "Đang bảo trì";
            case MISSING -> "Chờ ghi giảm do mất";
            case TRANSFERRING -> "Đang điều chuyển";
            case PENDING_LIQUIDATION -> "Chờ thanh lý";
            case LIQUIDATED -> "Đã thanh lý";
            case PENDING_DESTRUCTION -> "Chờ tiêu huỷ";
            case DESTROYED -> "Đã tiêu huỷ";
            case LOST -> "Mất";
            case NOT_DELIVERED -> "Thiếu khi điều chuyển";
            case USED_UP -> "Đã dùng hết";
        };
    }

    public static String conditionLabel(EquipmentCondition condition) {
        if (condition == null) {
            return null;
        }
        return switch (condition) {
            case TOT -> "Tốt";
            case TRUNG_BINH -> "Trung bình";
            case KEM -> "Kém";
            case HONG -> "Hỏng";
        };
    }
}
