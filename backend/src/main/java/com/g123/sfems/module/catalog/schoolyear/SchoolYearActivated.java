package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;

/**
 * Một năm học vừa thành năm hiện hành (Sở bật cờ). Phát trong giao dịch ghi năm học; người nghe dùng
 * {@code @TransactionalEventListener(BEFORE_COMMIT)} để lúc đó năm học đã có id.
 */
public record SchoolYearActivated(SchoolYear year) {
}
