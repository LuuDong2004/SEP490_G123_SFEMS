package com.g123.sfems.domain.system.notification;

import com.g123.sfems.domain.security.user.UserType;
import java.util.EnumSet;
import java.util.Set;

/**
 * Loại thông báo: thông báo nói về việc GÌ — khác {@link NotificationLevel} (mức độ). Loại quyết định thông báo có
 * được gửi email không: quản trị bật / tắt từng loại toàn hệ thống ({@code notification_type_settings}), người dùng
 * bật / tắt email cho loại của mình ({@code notification_preferences}).
 *
 * <p>Thêm loại mới: thêm hằng ở đây + một dòng {@code notification_type_settings} bằng changelog.
 */
public enum NotificationType {
    /** Phiếu (đề xuất, kế hoạch, ghi tăng, kiểm kê) tới lượt người nhận duyệt. */
    VOUCHER_PENDING("Phiếu chờ duyệt", true, true, EnumSet.of(UserType.SCHOOL, UserType.SO)),
    /** Phiếu của người nhận được duyệt, bị trả lại hoặc bị từ chối. */
    VOUCHER_RESULT("Kết quả duyệt phiếu", true, true, EnumSet.of(UserType.SCHOOL, UserType.SO)),
    /** Sở phát động đợt kiểm kê. */
    INVENTORY_CAMPAIGN("Đợt kiểm kê", true, true, EnumSet.of(UserType.SCHOOL)),
    /**
     * Năm học mới thành hiện hành (trường khai dữ liệu đầu năm), trường xác nhận đã khai (báo Sở), điều chỉnh chuẩn tối
     * thiểu hết hiệu lực.
     */
    YEAR_PROFILE("Hồ sơ năm học, chuẩn tối thiểu", true, true, EnumSet.of(UserType.SCHOOL, UserType.SO)),
    /** Cảnh báo vận hành (thư thông báo gửi lỗi…) — không tắt được trên hệ thống. */
    SYSTEM_ALERT("Cảnh báo vận hành", true, false, EnumSet.of(UserType.SYSTEM)),
    /** Quản trị gửi tay — luôn tới nơi. */
    ADMIN_MESSAGE("Thông báo của quản trị", false, false, EnumSet.allOf(UserType.class));

    private final String label;
    private final boolean emailByDefault;
    private final boolean inAppOptional;
    private final Set<UserType> audience;

    NotificationType(String label, boolean emailByDefault, boolean inAppOptional, Set<UserType> audience) {
        this.label = label;
        this.emailByDefault = emailByDefault;
        this.inAppOptional = inAppOptional;
        this.audience = audience;
    }

    public String label() {
        return label;
    }

    /** Email bật sẵn cho loại này khi quản trị chưa đổi. */
    public boolean emailByDefault() {
        return emailByDefault;
    }

    /** Quản trị được tắt thông báo trên hệ thống của loại này không. */
    public boolean inAppOptional() {
        return inAppOptional;
    }

    /** Loại tài khoản nhận loại thông báo này — người dùng chỉ thấy các loại của mình ở màn cài đặt. */
    public boolean reaches(UserType type) {
        return audience.contains(type);
    }
}
