package com.g123.sfems.domain.system.notification;

/**
 * Mức chú ý của một thông báo. Chỉ bốn giá trị: đây là thứ chuông đổi thành biểu tượng và màu, không
 * phải "chức năng nào phát ra" — cái đó nằm ở tiêu đề và đường dẫn.
 */
public enum NotificationLevel {
    /** Có chuyện đáng biết. Mặc định. */
    INFO,
    /** Việc gì đó xong và thành công. */
    SUCCESS,
    /** Cần để ý trước khi thành vấn đề. */
    WARNING,
    /** Có việc thất bại. */
    ERROR
}
