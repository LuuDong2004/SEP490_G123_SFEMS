package com.g123.sfems.shared.validation;

import java.math.BigDecimal;
import java.time.Year;

/**
 * Bộ quy tắc chuẩn cho trường SỐ: khoảng giá trị và số chữ số thập phân. Cùng nguồn với frontend như
 * {@link FieldRule}.
 */
public enum NumberRule {

    /** Tiền (đồng), không âm. Hai số lẻ vì giá trị tách lô / hao mòn chia ra có phần lẻ. */
    MONEY("0", "100000000000", 2),
    /** Đơn giá trên phiếu ghi tăng: đồng, số nguyên, tới 10 tỷ một đơn vị. */
    UNIT_PRICE("0", "10000000000", 0),
    /** Số lượng thiết bị: nguyên, ít nhất 1. */
    QUANTITY("1", "10000", 0),
    /** Số lượng được bằng 0 (thực nhận, thực tế kiểm kê). */
    QUANTITY_OR_ZERO("0", "10000", 0),
    /** Số lượng vật tư, hoá chất: tới 3 chữ số thập phân. */
    DECIMAL_QUANTITY("0", "1000000", 3),
    PERCENT("0", "100", 2),
    /** Diện tích (m²) của phòng, khu vực: không âm, hai số lẻ, tới một triệu m². */
    AREA("0", "1000000", 2),
    /** Số đếm không âm: sĩ số, số lớp, số tháng bảo hành, thứ tự. */
    COUNT("0", "99999", 0),
    /** Năm (sản xuất, đưa vào sử dụng, ngân sách). Trần là năm nay + 1, tính lúc kiểm. */
    YEAR("1950", null, 0);

    private final BigDecimal min;
    private final BigDecimal max;
    private final int scale;

    NumberRule(String min, String max, int scale) {
        this.min = new BigDecimal(min);
        this.max = max == null ? null : new BigDecimal(max);
        this.scale = scale;
    }

    public BigDecimal min() {
        return min;
    }

    /** {@code null} với {@link #YEAR}: trần đổi theo năm, xem {@link #ceiling()}. */
    public BigDecimal max() {
        return max;
    }

    public BigDecimal ceiling() {
        return max != null ? max : BigDecimal.valueOf(Year.now(DateRule.VIETNAM).getValue() + 1L);
    }

    public int scale() {
        return scale;
    }

    public String violation(BigDecimal value) {
        if (value == null) {
            return null;
        }
        BigDecimal top = ceiling();
        if (value.compareTo(min) < 0 || value.compareTo(top) > 0) {
            // Năm in liền (2027), không ngăn hàng nghìn như số tiền (2.027).
            return this == YEAR ? "phải từ " + min.toPlainString() + " đến " + top.toPlainString()
                    : "phải từ " + Formats.number(min) + " đến " + Formats.number(top);
        }
        if (value.stripTrailingZeros().scale() > scale) {
            return scale == 0 ? "phải là số nguyên" : "tối đa " + scale + " chữ số thập phân";
        }
        return null;
    }
}
