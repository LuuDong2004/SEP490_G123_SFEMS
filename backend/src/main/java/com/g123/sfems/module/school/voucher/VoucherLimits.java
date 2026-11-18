package com.g123.sfems.module.school.voucher;

/**
 * Trần số dòng của một lần gửi. Mỗi dòng phiếu tra danh mục, tra tài sản trong cùng một giao dịch, nên không có trần
 * thì một yêu cầu vài trăm nghìn dòng giữ kết nối CSDL rất lâu.
 */
public final class VoucherLimits {

    public static final int MAX_LINES = 1000;
    public static final String TOO_MANY_LINES = "Một phiếu tối đa 1.000 dòng";
    /** Kết quả kiểm đếm một lần gửi: biên bản cả trường có thể hàng chục nghìn tài sản. */
    public static final int MAX_COUNT_LINES = 20000;
    public static final String TOO_MANY_COUNT_LINES = "Một lần ghi tối đa 20.000 dòng kiểm đếm";

    private VoucherLimits() {
    }
}
