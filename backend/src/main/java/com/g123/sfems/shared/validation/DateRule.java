package com.g123.sfems.shared.validation;

import java.time.LocalDate;
import java.time.ZoneId;

/** Khoảng ngày hợp lệ. Hôm nay tính theo giờ Việt Nam, không theo múi giờ của máy chủ. */
public enum DateRule {

    /** Việc ĐÃ xảy ra: ngày nhập, ngày hoá đơn, ngày kiểm kê, ngày sinh — không sau hôm nay. */
    PAST_OR_TODAY,
    /** Ngày bất kỳ hợp lý: hạn trả, hạn bảo hành, lịch, kế hoạch. */
    ANY;

    static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    static final LocalDate FLOOR = LocalDate.of(1950, 1, 1);
    static final LocalDate CEILING = LocalDate.of(2100, 12, 31);

    public String violation(LocalDate value) {
        if (value == null) {
            return null;
        }
        if (value.isBefore(FLOOR)) {
            return "không được trước " + Formats.date(FLOOR);
        }
        if (this == PAST_OR_TODAY && value.isAfter(LocalDate.now(VIETNAM))) {
            return "không được sau hôm nay";
        }
        if (value.isAfter(CEILING)) {
            return "không được sau " + Formats.date(CEILING);
        }
        return null;
    }
}
